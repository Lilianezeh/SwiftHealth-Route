"""The emails of an account: the code to confirm an email address and the code to reset a password.
Requirements: FR-48, FR-54, NFR-07. Spec: specs/2026-10-23-accounts-and-facility-ownership/ (Phase 2).

Plain text, one code, how long it lasts, and what to do if it was not asked for. No link (a code
cannot leak in a web address or a referrer), no address or name in the text, no medical advice.
`send_email` is told the email is `required`: with no Resend key it is logged in development and
refused elsewhere (EmailNotConfiguredError), never silently dropped. The route turns that error into
a 503.
"""

from app.core.security import (
    CHALLENGE_TOKEN_LIFETIME,
    EMAIL_CHANGE_PURPOSE,
    EMAIL_CODE_LIFETIME,
    EMAIL_CONFIRM_PURPOSE,
    LOGIN_CODE_PURPOSE,
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
    # The code sent to the NEW address when a logged-in person changes their email (FR-54).
    EMAIL_CHANGE_PURPOSE: (
        f"Confirm your new email for {BRAND}",
        "to confirm this as your new email address",
        EMAIL_CODE_LIFETIME,
    ),
    # The login code by email, for a person with neither the app nor SMS (owner's answer D19).
    LOGIN_CODE_PURPOSE: (f"Your {BRAND} login code", "to log in", CHALLENGE_TOKEN_LIFETIME),
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


async def send_account_exists_notice(to: str) -> None:
    """Tells the owner of an email that someone tried to sign up with it and that it is already an account.

    Sign-up gives the same answer on screen whether the email is an account or not (so nobody can find out
    who has one), so this email is how the owner learns it. Best effort and not `required`: with no Resend
    key nothing is sent. No code, no link, no name of the person who asked, no address in the text.
    """
    body = (
        f"Someone, maybe you, tried to sign up to {BRAND} with this email address. "
        "It already has an account.\n\n"
        "If it was you, log in with your password instead. "
        "If it was not you, ignore this email: nothing changes.\n"
    )
    await resend.send_email(to, f"You already have a {BRAND} account", body)


def account_notice_text(kind: str) -> tuple[str, str]:
    """The subject and body of a notice about the person's own account: the email was changed, or the account
    was closed. Plain text, no link, no code, no password, no address or number. Plain `def`: only builds
    text."""
    if kind == "email_changed":
        return (
            f"Your {BRAND} email was changed",
            f"The email address of your {BRAND} account was changed to a new one. "
            "This address no longer works for the account.\n\n"
            "If it was not you, contact the team at once.\n",
        )
    if kind == "account_closed":
        return (
            f"Your {BRAND} account was closed",
            f"Your {BRAND} account was closed at your request. Your name, email and phone were removed.\n\n"
            "If it was not you, contact the team at once.\n",
        )
    raise ValueError(f"No notice text for {kind!r}.")


async def send_account_notice(to: str, kind: str) -> None:
    """Emails a notice about the person's own account. Best effort and not `required`: the caller catches
    `EmailSendError` and goes on, because the change is already saved."""
    subject, body = account_notice_text(kind)
    await resend.send_email(to, subject, body)


def decision_text(decision: str, detail: str | None) -> tuple[str, str]:
    """The subject and body of the email that tells a person what an admin decided about their account.

    `decision` is approved, rejected, suspended or reactivated. `detail` is the role (approved) or the
    admin's reason (rejected, suspended). Plain text: the app's name, what happened, what to do next. No
    link, no code, no password, no address or number, no medical text. Plain `def`: only builds text.
    """
    if decision == "approved":
        subject = f"Your {BRAND} account was approved"
        body = (
            f"An admin approved your {BRAND} staff account as {detail}. "
            "You can log in now with the email you signed up with.\n"
        )
    elif decision == "rejected":
        subject = f"Your {BRAND} sign-up was not approved"
        body = f"An admin did not approve your {BRAND} sign-up.\n"
        if detail:
            body += f"\nReason: {detail}\n"
        body += "\nIf you think this is a mistake, contact the team.\n"
    elif decision == "suspended":
        subject = f"Your {BRAND} account was suspended"
        body = f"An admin suspended your {BRAND} account, so you cannot log in for now.\n\nReason: {detail}\n"
        body += "\nIf you think this is a mistake, contact the team.\n"
    elif decision == "reactivated":
        subject = f"Your {BRAND} account is active again"
        body = f"An admin turned your {BRAND} account back on. You can log in again.\n"
    else:
        raise ValueError(f"No email text for the decision {decision!r}.")
    return subject, body


async def send_decision_notice(to: str, decision: str, detail: str | None = None) -> None:
    """Emails the person what an admin decided about their account. Best effort and not `required`: with
    no Resend key nothing is sent; the caller catches `EmailSendError` and goes on, because the decision
    is already saved."""
    subject, body = decision_text(decision, detail)
    await resend.send_email(to, subject, body)
