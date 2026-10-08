"""Termii SMS: sends the login code. Requirements: FR-30 (one-time code), NFR-06 (no secrets in logs).

Termii has no sandbox. With no TERMII_API_KEY (local development) the message, which holds the login code, is
logged instead of sent. With a key, the log holds only the masked phone and Termii's message id: never the
code, the API key or the full phone number.
API: POST {base_url}/api/sms/send (https://developers.termii.com/messaging-api).
"""
import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

SEND_PATH = "/api/sms/send"
TIMEOUT_SECONDS = 10.0  # our choice: Termii documents no timeout


class SmsSendError(Exception):
    """The SMS could not be sent. The message never contains the API key, the code or the phone number."""


def to_termii_number(phone: str) -> str:
    """Termii wants digits only: +2340000000001 becomes 2340000000001."""
    return phone.removeprefix("+")


def mask_phone(phone: str) -> str:
    """+2340000000001 becomes +234******0001 (the same shape as `sent_to` in the API spec)."""
    return phone[:4] + "*" * (len(phone) - 8) + phone[-4:]


def reject(masked_phone: str, reason: str) -> SmsSendError:
    """Logs the failure (masked phone only) and returns the error to raise."""
    logger.error("Termii SMS to %s failed: %s", masked_phone, reason)
    return SmsSendError(reason)


async def send_sms(phone: str, message: str, *, client: httpx.AsyncClient | None = None) -> None:
    """Sends `message` to `phone` (+234...). Raises SmsSendError if Termii does not accept it.

    `async def` because it awaits httpx. Tests pass their own `client` (with a mocked transport).
    """
    masked_phone = mask_phone(phone)
    if not settings.termii_api_key:
        logger.warning("TERMII_API_KEY is not set, so no SMS was sent. To %s: %s", masked_phone, message)
        return
    if not settings.termii_base_url:
        raise SmsSendError("TERMII_BASE_URL is not set. Copy your base URL from the Termii dashboard.")

    url = settings.termii_base_url.rstrip("/") + SEND_PATH
    payload = {
        "api_key": settings.termii_api_key,
        "to": to_termii_number(phone),
        "from": settings.termii_sender_id,
        "sms": message,
        "type": "plain",
        "channel": settings.termii_channel,
    }

    sending_client = client or httpx.AsyncClient(timeout=TIMEOUT_SECONDS)
    try:
        response = await sending_client.post(url, json=payload)
    except httpx.HTTPError as error:
        # Only the error class is used: the text of an httpx error can hold the URL or other request details.
        raise reject(masked_phone, f"Could not reach Termii ({type(error).__name__}).") from error
    finally:
        if client is None:
            await sending_client.aclose()

    # Termii documents the status codes but no error body, so a response body is never copied into an error
    # or a log.
    if not response.is_success:
        raise reject(masked_phone, f"Termii answered with HTTP {response.status_code}.")
    try:
        body = response.json()
    except ValueError:
        raise reject(masked_phone, "Termii sent a reply that is not JSON.") from None
    if not isinstance(body, dict) or body.get("code") != "ok":
        raise reject(masked_phone, "Termii did not accept the message.")

    logger.info("Termii SMS to %s sent, message id %s.", masked_phone, body.get("message_id"))
