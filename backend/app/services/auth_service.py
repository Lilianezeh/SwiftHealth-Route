"""Login rules: password, then a one-time code by SMS. Requirements: FR-30, NFR-06.

No HTTP here: the routes turn these domain errors into status codes (specs/backend/api-spec.md section 4).
Every function awaits the database or the SMS service, so they are async (decision 11).
"""
import math
from dataclasses import dataclass
from datetime import datetime

from sqlmodel.ext.asyncio.session import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.config import settings
from app.core.rate_limit import sms_code_limiter
from app.core.security import (
    LOGIN_CODE_PURPOSE,
    InvalidTokenError,
    code_matches,
    create_access_token,
    create_challenge_token,
    create_totp_challenge_token,
    decode_access_claims,
    decode_challenge_token,
    decode_totp_challenge_token,
    generate_login_code,
    hash_password,
    verify_password,
)
from app.integrations.resend import EmailSendError, mask_email
from app.integrations.termii import SmsSendError, mask_phone, send_sms
from app.models import User
from app.models.base import ApprovalStatus, utcnow
from app.repositories import user_repository
from app.services import account_mail_service, two_factor_service

MIN_SECONDS_BETWEEN_CODES = 60  # FR-57: the wait before "Send a new code" works, kept by the server too

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
    if user.phone_verified_at is None and phone_must_be_confirmed():
        raise AccountNotReadyError("Confirm your phone number first.")


def phone_must_be_confirmed() -> bool:
    """The phone is confirmed by an SMS code only when Termii is live (decision D20). Without Termii a
    sign-up leaves it not confirmed until an admin records a call, and the account works meanwhile."""
    return bool(settings.termii_api_key)


class MissingPhoneError(Exception):
    """The user has no phone number, so no code can be sent."""


class CodeNotSentError(Exception):
    """The SMS service did not accept the message."""


class InvalidCodeError(Exception):
    """The code or the challenge token is wrong, malformed, expired or tampered with."""


class CodeTooSoonError(Exception):
    """A new code was asked for under 60 seconds after the last one. `seconds_left` is the wait."""

    def __init__(self, seconds_left: int) -> None:
        super().__init__(seconds_left)
        self.seconds_left = seconds_left


class TooManyCodesError(Exception):
    """This account has had 5 codes in the last hour. `seconds_left` is how long until it may have another."""

    def __init__(self, seconds_left: int) -> None:
        super().__init__(seconds_left)
        self.seconds_left = seconds_left


class SmsNotAvailableError(Exception):
    """"Use SMS instead" was asked for, but Termii is not set up or the phone is not confirmed."""


@dataclass(frozen=True)
class LoginStarted:
    challenge_token: str
    sent_to: str | None  # masked phone or email; None for the app (nothing is sent)
    method: str = "sms"  # "sms", "email" or "totp"
    can_use_sms: bool = False  # with "totp": the person may ask for an SMS code instead


@dataclass(frozen=True)
class LoginCompleted:
    access_token: str
    user: User


async def start_login(session: AsyncSession, email: str, password: str, moment: datetime) -> LoginStarted:
    """Step 1: checks the password, then texts a 6-digit code and returns the challenge token."""
    user = await user_repository.get_by_email(session, email)
    password_hash = user.password_hash if user else _DUMMY_PASSWORD_HASH
    # run_in_threadpool (Starlette): Argon2 is slow CPU work, so it runs in a thread, off the event loop.
    password_is_right = await run_in_threadpool(verify_password, password, password_hash)
    if user is None or not password_is_right:
        raise InvalidCredentialsError
    # Only after the password is right, so this does not reveal which accounts exist.
    ensure_account_is_ready(user)
    if user.two_factor_enabled:  # the authenticator app: free, nothing is sent (FR-58)
        return LoginStarted(
            challenge_token=create_totp_challenge_token(user.id),
            sent_to=None,
            method="totp",
            can_use_sms=sms_is_possible(user),
        )
    channel = code_channel()
    if channel == "sms" and not user.phone:
        raise MissingPhoneError
    return await _send_login_code(user, moment, channel)


def sms_is_possible(user: User) -> bool:
    """True when an SMS can really be sent: Termii is set up and the person's phone is confirmed."""
    return bool(settings.termii_api_key) and bool(user.phone) and user.phone_verified_at is not None


def code_channel() -> str:
    """How a login code is sent to a person without the app: "sms" when Termii is set up, else "email" when
    Resend is (so a new account is never left with no way to log in while the SMS is not set up, D19), else
    "sms", which in development only logs the code."""
    if settings.termii_api_key:
        return "sms"
    if settings.resend_api_key and settings.resend_from_email:
        return "email"
    return "sms"


async def _send_login_code(user: User, moment: datetime, channel: str) -> LoginStarted:
    """Sends a new code by `channel` and returns its challenge token (FR-57: at most 5 codes an hour).

    Every code counts, the first one and the ones of a new login too, so logging in again cannot get around
    the limit. The limiter is plain Python state and nothing is awaited between its check and its update,
    so two requests cannot race on the event loop.
    """
    limiter_key = f"sms:{user.id}"
    if not sms_code_limiter.allow(limiter_key):
        raise TooManyCodesError(sms_code_limiter.retry_after_seconds(limiter_key))
    code = generate_login_code()
    token = create_challenge_token(user.id, code, sent_at=moment)
    if channel == "email":
        try:
            await account_mail_service.send_email_code(user.email, code, LOGIN_CODE_PURPOSE)
        except EmailSendError as error:
            raise CodeNotSentError from error
        return LoginStarted(challenge_token=token, sent_to=mask_email(user.email), method="email")
    try:
        await send_sms(user.phone, f"Your SwiftHealth login code is {code}. It expires in 5 minutes.")
    except SmsSendError as error:
        raise CodeNotSentError from error
    return LoginStarted(challenge_token=token, sent_to=mask_phone(user.phone), method="sms")


async def use_sms_instead(session: AsyncSession, challenge_token: str, moment: datetime) -> LoginStarted:
    """A person with the app asks for an SMS code instead: allowed only when SMS can really be sent."""
    try:
        user_id = decode_totp_challenge_token(challenge_token)
    except InvalidTokenError as error:
        raise InvalidCodeError from error
    user = await user_repository.get_by_id(session, user_id)
    if user is None:
        raise InvalidCodeError
    ensure_account_is_ready(user)
    if not user.two_factor_enabled:  # switched off since the password step: start again
        raise InvalidCodeError
    if not sms_is_possible(user):
        raise SmsNotAvailableError
    return await _send_login_code(user, moment, "sms")


async def resend_login_code(session: AsyncSession, challenge_token: str, moment: datetime) -> LoginStarted:
    """Step 1 again, without the password: a new code for the owner of the (unexpired) challenge token.

    At least 60 seconds after the previous send (read from the token), and inside the 5 codes an hour.
    """
    try:
        claims = decode_challenge_token(challenge_token)
    except InvalidTokenError as error:
        raise InvalidCodeError from error
    user = await user_repository.get_by_id(session, claims.user_id)
    if user is None:
        raise InvalidCodeError
    ensure_account_is_ready(user)
    channel = code_channel()
    if channel == "sms" and not user.phone:
        raise MissingPhoneError
    seconds_since_sent = max((moment - claims.sent_at).total_seconds(), 0)
    if seconds_since_sent < MIN_SECONDS_BETWEEN_CODES:
        raise CodeTooSoonError(math.ceil(MIN_SECONDS_BETWEEN_CODES - seconds_since_sent))
    return await _send_login_code(user, moment, channel)


async def verify_login_code(
    session: AsyncSession, challenge_token: str, code: str, moment: datetime
) -> LoginCompleted:
    """Step 2: checks the code against the challenge token and returns an access token.

    The token says what was asked for: a code that was sent (SMS or email), or a code from the app.
    """
    try:
        claims = decode_challenge_token(challenge_token)
    except InvalidTokenError:
        return await _verify_app_login(session, challenge_token, code, moment)
    if not code_matches(claims.user_id, code, claims.code_hash):
        raise InvalidCodeError

    user = await user_repository.get_by_id(session, claims.user_id)
    if user is None:
        raise InvalidCodeError
    ensure_account_is_ready(user)  # the account may have changed between the two steps

    await user_repository.set_last_login(session, user, utcnow())
    await session.commit()
    return LoginCompleted(access_token=create_access_token(user.id), user=user)


async def _verify_app_login(
    session: AsyncSession, challenge_token: str, code: str, moment: datetime
) -> LoginCompleted:
    """Step 2 for a person with the app: a code from it (once) or a backup code (once); 10 wrong lock it."""
    try:
        user_id = decode_totp_challenge_token(challenge_token)
    except InvalidTokenError as error:
        raise InvalidCodeError from error
    user = await user_repository.get_by_id(session, user_id)
    if user is None:
        raise InvalidCodeError
    ensure_account_is_ready(user)
    if not user.two_factor_enabled:  # switched off since the password step: start again
        raise InvalidCodeError
    try:
        await two_factor_service.check_second_factor(session, user, code, moment)
    except two_factor_service.WrongCodeError as error:
        raise InvalidCodeError from error
    await user_repository.set_last_login(session, user, utcnow())
    await session.commit()
    return LoginCompleted(access_token=create_access_token(user.id), user=user)


async def get_user_for_token(session: AsyncSession, access_token: str) -> User:
    """Loads the user an access token belongs to. The role and is_active come from this database row.

    Raises InvalidTokenError for a bad token or a deleted user, InactiveAccountError for a deactivated user,
    AccountNotReadyError for an account that is waiting, rejected, closed or not confirmed.
    """
    claims = decode_access_claims(access_token)
    user = await user_repository.get_by_id(session, claims.user_id)
    if user is None:
        raise InvalidTokenError("User not found")
    if user.password_changed_at is not None:
        changed_ms = int(user.password_changed_at.timestamp() * 1000)
        if claims.issued_ms is None or claims.issued_ms < changed_ms:
            raise InvalidTokenError("The password was changed after this token was made")  # decision D10
    ensure_account_is_ready(user)
    return user
