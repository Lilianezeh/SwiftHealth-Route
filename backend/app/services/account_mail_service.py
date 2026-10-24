"""The emails of an account: the code to confirm an email address and the code to reset a password.
Requirements: FR-48, FR-54, NFR-07. Spec: specs/2026-10-23-accounts-and-facility-ownership/ (Phase 2).

Plain text, one code, how long it lasts, and what to do if it was not asked for. No link (a code
cannot leak in a web address or a referrer), no address or name in the text, no medical advice.
`send_email` is told the email is `required`: with no Resend key it is logged in development and
refused elsewhere (EmailNotConfiguredError), never silently dropped. The route turns that error into
a 503.
"""

from app.core.security import (
    EMAIL_CODE_LIFETIME,
    EMAIL_CONFIRM_PURPOSE,
    PASSWORD_RESET_LIFETIME,
    PASSWORD_RESET_PURPOSE,
)
from app.integrations import resend

BRAND = "SwiftHealth Route"

# purpose -> (subject, what the code is for, how long it lasts)
_TEXTS = {
    EMAIL_CONFIRM_PURPOSE: (
        f"Confirm your email for {BRAND}",
        "to confirm your email address",
        EMAIL_CODE_LIFETIME,
    ),
    PASSWORD_RESET_PURPOSE: (
        f"Reset your {BRAND} password",
        "to reset your password",
        PASSWORD_RESET_LIFETIME,
    ),
}


async def send_email_code(to: str, code: str, purpose: str) -> None:
    """Emails the 6-digit code. Raises ValueError for an unknown purpose, EmailSendError if not sent."""
    if purpose not in _TEXTS:
        raise ValueError(f"No email text for the purpose {purpose!r}.")
    subject, reason, lifetime = _TEXTS[purpose]
    minutes = int(lifetime.total_seconds() // 60)
    body = (
        f"Your {BRAND} code {reason} is {code}.\n\n"
        f"It works for {minutes} minutes. If you did not ask for it, ignore this email: nothing changes.\n"
    )
    await resend.send_email(to, subject, body, required=True)
