"""Resend email: tells the staff about a flagged listing. Requirements: FR-22, NFR-06, NFR-07.

API: POST https://api.resend.com/emails with `Authorization: Bearer <key>` and the fields `from`, `to`
(a list), `subject` and `text` (https://resend.com/docs/api-reference/emails/send-email). Not tested
against the real service: the tests use a mock transport. With no RESEND_API_KEY or no RESEND_FROM_EMAIL
nothing is sent. The log and every error hold no key and no address.
"""

import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

SEND_URL = "https://api.resend.com/emails"
TIMEOUT_SECONDS = 10.0  # our choice: Resend's page names no timeout


class EmailSendError(Exception):
    """The email could not be sent. The message never contains the API key or the address."""


async def send_email(to: str, subject: str, body: str, *, client: httpx.AsyncClient | None = None) -> None:
    """Sends a plain-text email. Raises EmailSendError if Resend does not accept it.

    `async def` because it awaits httpx. Tests pass their own `client` (with a mocked transport).
    """
    if not settings.resend_api_key or not settings.resend_from_email:
        logger.warning("RESEND_API_KEY or RESEND_FROM_EMAIL is not set, so no email was sent.")
        return

    payload = {"from": settings.resend_from_email, "to": [to], "subject": subject, "text": body}
    headers = {"Authorization": f"Bearer {settings.resend_api_key}"}
    sending_client = client or httpx.AsyncClient(timeout=TIMEOUT_SECONDS)
    try:
        response = await sending_client.post(SEND_URL, json=payload, headers=headers)
    except httpx.HTTPError as error:
        # Only the class of the error is used: the text of an httpx error can hold the address.
        raise EmailSendError(f"Could not reach Resend ({type(error).__name__}).") from error
    finally:
        if client is None:
            await sending_client.aclose()
    if not response.is_success:
        # The body is never copied: Resend's error text can repeat the address.
        raise EmailSendError(f"Resend answered with HTTP {response.status_code}.")
