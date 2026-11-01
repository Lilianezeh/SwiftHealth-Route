"""Email: Resend first, SMTP when Resend is not set up (integrations/smtp.py).
Requirements: FR-22, FR-48, NFR-06, NFR-07.
`send_email` here is the one function every service calls (the name is from the days when Resend
was the only way). The errors live in integrations/email_errors.py and are used from here.
Resend: tells the staff about a flagged listing, and sends the account codes.

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
from app.integrations import smtp
from app.integrations.email_errors import EmailNotConfiguredError, EmailSendError

logger = logging.getLogger(__name__)

SEND_URL = "https://api.resend.com/emails"
TIMEOUT_SECONDS = 10.0  # our choice: Resend's page names no timeout


def mask_email(email: str) -> str:
    """ada@example.com becomes a***@example.com: the first letter and the domain (the screen's hint, D19)."""
    name, _, domain = email.partition("@")
    return f"{name[:1]}***@{domain}"


async def send_email(
    to: str, subject: str, body: str, *, required: bool = False, client: httpx.AsyncClient | None = None
) -> None:
    """Sends a plain-text email. Raises EmailSendError if it cannot be sent.

    THE ONE FUNCTION EVERY SERVICE CALLS to send an email. Resend is used when it is set up (a key and a
    sender); when it is not, SMTP is used if that is set up (integrations/smtp.py, free: a Gmail account
    with an app password). With neither, an ordinary email (a staff alert) is skipped with a warning. A
    `required` email (the code of an account) is different, because skipping it would leave a person who can
    never confirm their account: in development its text, which holds the code, is logged (like the Termii
    SMS); in any other environment EmailNotConfiguredError is raised, and nothing about the email is logged.

    `async def` because it awaits httpx or the SMTP thread. Tests pass their own `client` (with a mocked
    transport) for Resend.
    """
    if not settings.resend_configured:
        if settings.smtp_configured:
            await smtp.send_email(to, subject, body)
            return
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
