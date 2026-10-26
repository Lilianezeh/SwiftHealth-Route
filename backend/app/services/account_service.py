"""Account self-service: details, a new email or phone, a new password, a forgotten password, closing.
Requirements: FR-54, FR-56, NFR-06, NFR-07, US-21. Spec: specs/backend/api-spec.md section 4d; decisions
D9, D10 and D13 of specs/2026-10-23-accounts-and-facility-ownership/ and D20 (the phone).

A new email or phone replaces the old one only after a code sent to the NEW one is confirmed. A changed or
reset password sets `password_changed_at`, and an access token made before it is refused
(auth_service.get_user_for_token). A forgotten password is reset with a code by email, and the answer never
says whether the email is an account (a decoy token for an unknown one). Closing removes the personal data
and keeps the row and every audit entry. Nothing here logs or audits a password, a code, a token, an
address or a number: the audit entries say only "changed". Everything that waits on the database, the mail
or the SMS is async; the helpers that only compute are plain `def`.
"""

import logging
import secrets
from dataclasses import dataclass
from datetime import datetime

from sqlmodel.ext.asyncio.session import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.config import settings
from app.core.passwords import PasswordRuleError, check_password
from app.core.rate_limit import (
    forgot_email_limiter,
    password_failure_limiter,
    signup_code_failure_limiter,
    sms_code_limiter,
)
from app.core.security import (
    EMAIL_CHANGE_PURPOSE,
    EMAIL_CODE_LIFETIME,
    PASSWORD_RESET_LIFETIME,
    PASSWORD_RESET_PURPOSE,
    PHONE_CHANGE_PURPOSE,
    PHONE_CODE_LIFETIME,
    ChallengeClaims,
    InvalidTokenError,
    code_matches,
    create_access_token,
    create_code_token,
    decode_code_token,
    generate_login_code,
    hash_password,
    verify_password,
)
from app.integrations.resend import EmailNotConfiguredError, EmailSendError, mask_email
from app.integrations.termii import SmsSendError, mask_phone, send_sms
from app.models import User
from app.models.base import ApprovalStatus, Role
from app.repositories import audit_repository, user_repository
from app.schemas.account import AccountRead
from app.services import account_mail_service
from app.services.account_decision_service import LastAdminError
from app.services.auth_service import CodeNotSentError, TooManyCodesError, phone_must_be_confirmed

logger = logging.getLogger(__name__)

CHANGED = "changed"
CLOSED_NAME = "Closed account"

__all__ = [
    "AccountCodeLockedError",
    "EmailNotSentError",
    "EmailNotSetUpError",
    "EmailTakenError",
    "InvalidAccountCodeError",
    "LastAdminError",
    "NothingToChangeError",
    "PasswordLockedError",
    "TooManyResetsError",
    "WrongPasswordError",
]


class EmailTakenError(Exception):
    """Another account already has this email."""


class NothingToChangeError(Exception):
    """The new email or phone is the one the account already has. `what` is "email" or "phone"."""

    def __init__(self, what: str) -> None:
        super().__init__(what)
        self.what = what


class InvalidAccountCodeError(Exception):
    """The token or the code is wrong, expired, used, made for something else or for another account."""


class AccountCodeLockedError(Exception):
    """Ten wrong codes in an hour for this account. `seconds_left` is the wait."""

    def __init__(self, seconds_left: int) -> None:
        super().__init__(seconds_left)
        self.seconds_left = seconds_left


class WrongPasswordError(Exception):
    """The current password is not right."""


class PasswordLockedError(Exception):
    """Ten wrong current passwords in 15 minutes. `seconds_left` is the wait."""

    def __init__(self, seconds_left: int) -> None:
        super().__init__(seconds_left)
        self.seconds_left = seconds_left


class TooManyResetsError(Exception):
    """Three "I forgot my password" requests in an hour for this email. `seconds_left` is the wait."""

    def __init__(self, seconds_left: int) -> None:
        super().__init__(seconds_left)
        self.seconds_left = seconds_left


class EmailNotSetUpError(Exception):
    """Email cannot be sent here: no Resend key outside development. The route answers 503."""


class EmailNotSentError(Exception):
    """Resend did not accept the email. The route answers 502."""


@dataclass(frozen=True)
class ContactStep:
    confirm_token: str | None
    sent_to: str | None


def profile(user: User) -> AccountRead:
    """The caller's own details. Plain `def`: it only reads fields already in memory."""
    return AccountRead(
        id=user.id,  # type: ignore[arg-type]  # a loaded row has an id
        name=user.name,
        email=user.email,
        phone=user.phone,
        role=user.role,
        approval_status=user.approval_status,
        email_confirmed=user.email_verified_at is not None,
        phone_confirmed=user.phone_verified_at is not None,
        two_factor_enabled=user.two_factor_enabled,
    )


async def _audit(
    session: AsyncSession,
    user: User,
    action: str,
    field: str,
    old: str | None,
    new: str | None,
    moment: datetime,
) -> None:
    await audit_repository.add_entry(
        session,
        user_id=user.id,
        listing_id=None,
        action=action,
        field_changed=field,
        old_value=old,
        new_value=new,
        changed_at=moment,
    )


async def change_name(session: AsyncSession, user: User, name: str, moment: datetime) -> User:
    if name != user.name:
        await _audit(session, user, "account_update", "name", user.name, name, moment)
        user.name = name
        await user_repository.save(session, user)
        await session.commit()
    return user


# --- codes: the limits shared by the routes below ---


async def _use_a_code(session: AsyncSession, key: str) -> None:
    """Counts one code (email or SMS) for the account: 5 an hour, the first included. Over the limit,
    what was changed in this request is undone before the error goes up."""
    if not sms_code_limiter.allow(key):
        await session.rollback()
        raise TooManyCodesError(sms_code_limiter.retry_after_seconds(key))


def _ensure_not_locked(key: str) -> None:
    seconds_left = signup_code_failure_limiter.retry_after_seconds(key)
    if seconds_left > 0:
        raise AccountCodeLockedError(seconds_left)


def _wrong_code(key: str) -> InvalidAccountCodeError:
    signup_code_failure_limiter.allow(key)  # counts one wrong try
    return InvalidAccountCodeError()


def _claims(token: str, purpose: str, user_id: int | None) -> ChallengeClaims:
    """The claims of a code token. A bad token, one of another kind or one made for another account is
    `InvalidAccountCodeError`."""
    try:
        claims = decode_code_token(token, purpose)
    except InvalidTokenError:
        raise InvalidAccountCodeError from None
    if user_id is not None and claims.user_id != user_id:
        raise InvalidAccountCodeError
    return claims


def _email_can_be_sent() -> bool:
    has_key = bool(settings.resend_api_key and settings.resend_from_email)
    return settings.app_env == "development" or has_key


async def _send_email_code(to: str, code: str, purpose: str) -> None:
    try:
        await account_mail_service.send_email_code(to, code, purpose)
    except EmailNotConfiguredError:
        raise EmailNotSetUpError from None
    except EmailSendError:
        raise EmailNotSentError from None


async def _tell(email: str, kind: str) -> None:
    """A notice to the person's own address after the change is saved. Never raises."""
    try:
        await account_mail_service.send_account_notice(email, kind)
    except EmailSendError:
        logger.warning("The %s notice could not be sent.", kind)  # no address in the log


# --- a new email ---


async def start_email_change(
    session: AsyncSession, user: User, new_email: str, moment: datetime
) -> ContactStep:
    if new_email == user.email:
        raise NothingToChangeError("email")
    if await user_repository.get_by_email(session, new_email) is not None:
        raise EmailTakenError
    await _use_a_code(session, f"mail:{user.id}")
    code = generate_login_code()
    await _send_email_code(new_email, code, EMAIL_CHANGE_PURPOSE)
    token = create_code_token(
        user.id, code, EMAIL_CHANGE_PURPOSE, EMAIL_CODE_LIFETIME, sent_at=moment, new_value=new_email
    )
    return ContactStep(confirm_token=token, sent_to=mask_email(new_email))


async def confirm_email_change(
    session: AsyncSession, user: User, token: str, code: str, moment: datetime
) -> User:
    key = f"account:{user.id}"
    _ensure_not_locked(key)
    try:
        claims = _claims(token, EMAIL_CHANGE_PURPOSE, user.id)
    except InvalidAccountCodeError:
        raise _wrong_code(key) from None
    if claims.new_value is None or not code_matches(user.id, code, claims.code_hash):
        raise _wrong_code(key)
    if await user_repository.get_by_email(session, claims.new_value) is not None:
        raise EmailTakenError
    old_email = user.email  # read before the commit
    user.email = claims.new_value
    user.email_verified_at = moment
    await user_repository.save(session, user)
    await _audit(session, user, "account_update", "email", CHANGED, CHANGED, moment)
    await session.commit()
    await _tell(old_email, "email_changed")
    return user


# --- a new phone ---


async def start_phone_change(
    session: AsyncSession, user: User, new_phone: str, moment: datetime
) -> ContactStep:
    """With Termii live: a code is texted to the NEW number and the number is replaced after it. Without
    Termii no SMS can be sent, so the number is replaced at once and left not confirmed until an admin
    records a call (decision D20)."""
    if new_phone == user.phone:
        raise NothingToChangeError("phone")
    if not phone_must_be_confirmed():
        user.phone = new_phone
        user.phone_verified_at = None
        await user_repository.save(session, user)
        await _audit(session, user, "account_update", "phone", CHANGED, CHANGED, moment)
        await session.commit()
        return ContactStep(confirm_token=None, sent_to=None)
    await _use_a_code(session, f"sms:{user.id}")
    code = generate_login_code()
    text = f"Your SwiftHealth Route code to confirm your new phone is {code}. It works for 5 minutes."
    try:
        await send_sms(new_phone, text)
    except SmsSendError:
        raise CodeNotSentError from None
    token = create_code_token(
        user.id, code, PHONE_CHANGE_PURPOSE, PHONE_CODE_LIFETIME, sent_at=moment, new_value=new_phone
    )
    return ContactStep(confirm_token=token, sent_to=mask_phone(new_phone))


async def confirm_phone_change(
    session: AsyncSession, user: User, token: str, code: str, moment: datetime
) -> User:
    key = f"account:{user.id}"
    _ensure_not_locked(key)
    try:
        claims = _claims(token, PHONE_CHANGE_PURPOSE, user.id)
    except InvalidAccountCodeError:
        raise _wrong_code(key) from None
    if claims.new_value is None or not code_matches(user.id, code, claims.code_hash):
        raise _wrong_code(key)
    user.phone = claims.new_value
    user.phone_verified_at = moment
    await user_repository.save(session, user)
    await _audit(session, user, "account_update", "phone", CHANGED, CHANGED, moment)
    await session.commit()
    return user


# --- the password ---


async def _check_current_password(user: User, current_password: str) -> None:
    """Counts a wrong password and locks after ten in 15 minutes.
    run_in_threadpool: Argon2 is slow CPU work."""
    key = f"password:{user.id}"
    seconds_left = password_failure_limiter.retry_after_seconds(key)
    if seconds_left > 0:
        raise PasswordLockedError(seconds_left)
    if not await run_in_threadpool(verify_password, current_password, user.password_hash):
        password_failure_limiter.allow(key)
        raise WrongPasswordError


async def change_password(
    session: AsyncSession, user: User, current_password: str, new_password: str, moment: datetime
) -> str:
    """Sets a new password and returns a fresh access token (every older one stops working, D10)."""
    await _check_current_password(user, current_password)
    if new_password == current_password:
        raise PasswordRuleError("Choose a password you have not used for this account.")
    check_password(new_password, user.role, user.email)  # PasswordRuleError: the route answers 422
    user.password_hash = await run_in_threadpool(hash_password, new_password)
    user.password_changed_at = moment
    await user_repository.save(session, user)
    await _audit(session, user, "account_update", "password", None, CHANGED, moment)
    await session.commit()
    return create_access_token(user.id)


# --- a forgotten password ---


def _can_reset(user: User | None) -> bool:
    """An account that could log in once its password is known: confirmed, active, not closed or rejected."""
    return (
        user is not None
        and user.is_active
        and user.closed_at is None
        and user.approval_status != ApprovalStatus.rejected.value
        and user.email_verified_at is not None
    )


async def forgot_password(session: AsyncSession, email: str, moment: datetime) -> tuple[str, str]:
    """Always gives a token and a hint, whether or not the email is an account (a decoy token for an
    unknown one). Returns (reset_token, sent_to). A failure to send is logged and hidden, so it tells
    nothing either."""
    key = f"forgot:{email}"
    if not forgot_email_limiter.allow(key):
        raise TooManyResetsError(forgot_email_limiter.retry_after_seconds(key))
    if not _email_can_be_sent():
        raise EmailNotSetUpError
    user = await user_repository.get_by_email(session, email)
    code = generate_login_code()
    user_id = 0  # the decoy: no account has this id, so its code can never be confirmed
    if user is not None and _can_reset(user):
        user_id = user.id  # type: ignore[assignment]
        if sms_code_limiter.allow(f"mail:{user_id}"):
            try:
                await account_mail_service.send_email_code(email, code, PASSWORD_RESET_PURPOSE)
            except (EmailSendError, EmailNotConfiguredError):
                logger.warning("The password reset email could not be sent.")  # same answer either way
    token = create_code_token(
        user_id, code, PASSWORD_RESET_PURPOSE, PASSWORD_RESET_LIFETIME, sent_at=moment
    )
    return token, mask_email(email)


async def reset_password(
    session: AsyncSession, token: str, code: str, new_password: str, moment: datetime
) -> None:
    try:
        claims = decode_code_token(token, PASSWORD_RESET_PURPOSE)
    except InvalidTokenError:
        raise InvalidAccountCodeError from None
    key = f"reset:{claims.user_id}"
    _ensure_not_locked(key)
    user = await user_repository.get_by_id(session, claims.user_id) if claims.user_id else None
    if user is None or not _can_reset(user) or not code_matches(user.id, code, claims.code_hash):  # type: ignore[arg-type]
        raise _wrong_code(key)
    changed_at = user.password_changed_at
    if changed_at is not None and changed_at.timestamp() >= claims.sent_at.timestamp():
        raise _wrong_code(key)  # the password was set after this code was sent: the code was used
    check_password(new_password, user.role, user.email)  # PasswordRuleError: the route answers 422
    user.password_hash = await run_in_threadpool(hash_password, new_password)
    user.password_changed_at = moment
    await user_repository.save(session, user)
    await _audit(session, user, "account_update", "password", None, CHANGED, moment)
    await session.commit()


# --- closing the account ---


async def close_account(session: AsyncSession, user: User, password: str, moment: datetime) -> None:
    """Removes the personal data and turns the account off; the row and every audit entry stay."""
    await _check_current_password(user, password)
    if user.role == Role.admin:
        others = await user_repository.count_other_active_admins(session, user.id)  # type: ignore[arg-type]
        if others == 0:
            raise LastAdminError
    old_email = user.email
    user.name = CLOSED_NAME
    user.email = f"closed-{user.id}@closed.invalid"  # cannot be an address, and is unique
    user.phone = None
    user.signup_note = None
    user.email_verified_at = None
    user.phone_verified_at = None
    user.password_hash = await run_in_threadpool(hash_password, secrets.token_urlsafe(32))
    user.password_changed_at = moment  # every older token stops working too
    user.totp_secret = None
    user.totp_enabled_at = None
    user.totp_last_step = None
    user.backup_code_hashes = None
    user.closed_at = moment
    user.is_active = False
    await user_repository.save(session, user)
    await _audit(session, user, "account_close", "account", None, "closed", moment)
    await session.commit()
    await _tell(old_email, "account_closed")


def access_token_lifetime_seconds() -> int:
    return settings.jwt_minutes * 60
