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
from app.models.base import utcnow
from app.repositories import user_repository

# Checked when the email is unknown, so an unknown email takes as long as a wrong password (NFR-06).
# It is the hash of a throwaway string, not a real password.
_DUMMY_PASSWORD_HASH = hash_password("password-for-unknown-emails")


class InvalidCredentialsError(Exception):
    """Wrong email or wrong password. The caller must not say which."""


class InactiveAccountError(Exception):
    """The account is deactivated."""


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
    # run_in_threadpool (Starlette): bcrypt is slow CPU work, so it runs in a thread, off the event loop.
    password_is_right = await run_in_threadpool(verify_password, password, password_hash)
    if user is None or not password_is_right:
        raise InvalidCredentialsError
    if not user.is_active:  # only after the password is right, so this does not reveal which accounts exist
        raise InactiveAccountError
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
    if not user.is_active:  # deactivated between the two steps
        raise InactiveAccountError

    await user_repository.set_last_login(session, user, utcnow())
    await session.commit()
    return LoginCompleted(access_token=create_access_token(user.id), user=user)


async def get_user_for_token(session: AsyncSession, access_token: str) -> User:
    """Loads the user an access token belongs to. The role and is_active come from this database row.

    Raises InvalidTokenError for a bad token or a deleted user, InactiveAccountError for a deactivated user.
    """
    user_id = decode_access_token(access_token)
    user = await user_repository.get_by_id(session, user_id)
    if user is None:
        raise InvalidTokenError("User not found")
    if not user.is_active:
        raise InactiveAccountError
    return user
