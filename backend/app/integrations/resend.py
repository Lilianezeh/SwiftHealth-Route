"""Resend email: tells the staff about a flagged listing. Requirements: FR-22, NFR-06, NFR-07.

API: POST https://api.resend.com/emails with `Authorization: Bearer <key>` and the fields `from`, `to`
(a list), `subject` and `text` (https://resend.com/docs/api-reference/emails/send-email). Not tested
against the real service: the tests use a mock transport. With no RESEND_API_KEY or no RESEND_FROM_EMAIL
nothing is sent (an account code is the exception, see `send_email`). The log and every error hold no key and
no address. Sending to real people needs a sending domain verified in Resend
(specs/2026-10-23-accounts-and-facility-ownership/).
"""

import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

SEND_URL = "https://api.resend.com/emails"
TIMEOUT_SECONDS = 10.0  # our choice: Resend's page names no timeout


def mask_email(email: str) -> str:
    """ada@example.com becomes a***@example.com: the first letter and the domain (the screen's hint, D19)."""
    name, _, domain = email.partition("@")
    return f"{name[:1]}***@{domain}"


class EmailSendError(Exception):
    """The email could not be sent. The message never contains the API key or the address."""


class EmailNotConfiguredError(EmailSendError):
    """A required email (an account code) cannot be sent: no Resend key or sender, outside development."""


async def send_email(
    to: str, subject: str, body: str, *, required: bool = False, client: httpx.AsyncClient | None = None
) -> None:
    """Sends a plain-text email. Raises EmailSendError if Resend does not accept it.

    With no key or no sender, an ordinary email (a staff alert) is skipped with a warning. A `required`
    email (the code of an account) is different, because skipping it would leave a person who can never
    confirm their account: in development its text, which holds the code, is logged (like the Termii SMS);
    in any other environment EmailNotConfiguredError is raised, and nothing about the email is logged.

    `async def` because it awaits httpx. Tests pass their own `client` (with a mocked transport).
    """
    if not settings.resend_api_key or not settings.resend_from_email:
        if not required:
            logger.warning("RESEND_API_KEY or RESEND_FROM_EMAIL is not set, so no email was sent.")
            return
        if settings.app_env != "development":
            raise EmailNotConfiguredError("RESEND_API_KEY or RESEND_FROM_EMAIL is not set.")
        logger.warning(
            "RESEND_API_KEY or RESEND_FROM_EMAIL is not set, so no email was sent. Subject: %s. Text: %s",
            subject,
            body,
        )
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
