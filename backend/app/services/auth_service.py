"""Login rules: password, then a one-time code by SMS. Requirements: FR-30, NFR-06.

No HTTP here: the routes turn these domain errors into status codes (specs/backend/api-spec.md section 4).
Every function awaits the database or the SMS service, so they are async (decision 11).
"""
from dataclasses import dataclass

from sqlmodel.ext.asyncio.session import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.security import (
    InvalidTokenError,
    code_matches,
    create_access_token,
    create_challenge_token,
    decode_access_token,
    decode_challenge_token,
    generate_login_code,
    hash_password,
    verify_password,
)
from app.integrations.termii import SmsSendError, mask_phone, send_sms
from app.models import User
from app.models.base import ApprovalStatus, utcnow
from app.repositories import user_repository

# Checked when the email is unknown, so an unknown email takes as long as a wrong password (NFR-06).
# It is the hash of a throwaway string, not a real password.
_DUMMY_PASSWORD_HASH = hash_password("password-for-unknown-emails")


class InvalidCredentialsError(Exception):
    """Wrong email or wrong password. The caller must not say which."""


class InactiveAccountError(Exception):
    """The account is deactivated."""


class AccountNotReadyError(Exception):
    """The account cannot be used yet or any more: waiting, rejected, closed, or email or phone not confirmed.

    `message` is a plain sentence for the person; the route answers 403 with it (FR-48, FR-49).
    """

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


def ensure_account_is_ready(user: User) -> None:
    """Returns quietly when the account may be used, otherwise raises the error that says why.

    Used by the login and by `get_current_user`, so every endpoint that needs a login is covered by one check.
    Plain `def`: it only reads fields already in memory (decision 11).
    """
    if user.closed_at is not None:
        raise AccountNotReadyError("This account is closed.")
    if user.approval_status == ApprovalStatus.rejected.value:
        raise AccountNotReadyError("This account was not approved.")
    if user.approval_status != ApprovalStatus.approved.value:  # pending, or an unknown value: no access
        raise AccountNotReadyError("This account is waiting for approval by an admin.")
    if not user.is_active:
        raise InactiveAccountError
    if user.email_verified_at is None:
        raise AccountNotReadyError("Confirm your email address first.")
    if user.phone_verified_at is None:
        raise AccountNotReadyError("Confirm your phone number first.")


class MissingPhoneError(Exception):
    """The user has no phone number, so no code can be sent."""


class CodeNotSentError(Exception):
    """The SMS service did not accept the message."""


class InvalidCodeError(Exception):
    """The code or the challenge token is wrong, malformed, expired or tampered with."""


@dataclass(frozen=True)
class LoginStarted:
    challenge_token: str
    sent_to: str


@dataclass(frozen=True)
class LoginCompleted:
    access_token: str
    user: User


async def start_login(session: AsyncSession, email: str, password: str) -> LoginStarted:
    """Step 1: checks the password, then texts a 6-digit code and returns the challenge token."""
    user = await user_repository.get_by_email(session, email)
    password_hash = user.password_hash if user else _DUMMY_PASSWORD_HASH
    # run_in_threadpool (Starlette): Argon2 is slow CPU work, so it runs in a thread, off the event loop.
    password_is_right = await run_in_threadpool(verify_password, password, password_hash)
    if user is None or not password_is_right:
        raise InvalidCredentialsError
    # Only after the password is right, so this does not reveal which accounts exist.
    ensure_account_is_ready(user)
    if not user.phone:
        raise MissingPhoneError

    code = generate_login_code()
    try:
        await send_sms(user.phone, f"Your SwiftHealth login code is {code}. It expires in 5 minutes.")
    except SmsSendError as error:
        raise CodeNotSentError from error
    return LoginStarted(
        challenge_token=create_challenge_token(user.id, code), sent_to=mask_phone(user.phone)
    )


async def verify_login_code(session: AsyncSession, challenge_token: str, code: str) -> LoginCompleted:
    """Step 2: checks the code against the challenge token and returns an access token."""
    try:
        claims = decode_challenge_token(challenge_token)
    except InvalidTokenError as error:
        raise InvalidCodeError from error
    if not code_matches(claims.user_id, code, claims.code_hash):
        raise InvalidCodeError

    user = await user_repository.get_by_id(session, claims.user_id)
    if user is None:
        raise InvalidCodeError
    ensure_account_is_ready(user)  # the account may have changed between the two steps

    await user_repository.set_last_login(session, user, utcnow())
    await session.commit()
    return LoginCompleted(access_token=create_access_token(user.id), user=user)


async def get_user_for_token(session: AsyncSession, access_token: str) -> User:
    """Loads the user an access token belongs to. The role and is_active come from this database row.

    Raises InvalidTokenError for a bad token or a deleted user, InactiveAccountError for a deactivated user,
    AccountNotReadyError for an account that is waiting, rejected, closed or not confirmed.
    """
    user_id = decode_access_token(access_token)
    user = await user_repository.get_by_id(session, user_id)
    if user is None:
        raise InvalidTokenError("User not found")
    ensure_account_is_ready(user)
    return user
