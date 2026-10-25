"""Sign-up of staff and facility owners (providers). Requirements: FR-48, FR-49, FR-56, NFR-06, NFR-07, US-17.
Spec: specs/2026-10-23-accounts-and-facility-ownership/ (Phase 3a); decisions D6, D8 and D2.

The road: `start_signup` makes the account (not usable: email and phone unconfirmed) and emails a code;
`confirm_email` checks it and, only when Termii is live, texts a code to the phone; `confirm_phone` checks
that. Without Termii the email code ends the road and the phone stays not confirmed until an admin records
a call (decision D20). A provider is then ready (`approved` from the start); a staff account is `pending`
and ready for nothing until an admin approves it (Phase 4). The codes are signed tokens (nothing is
stored), tied to the account and to what they are for.

Nobody can find out who has an account: sign-up gives the same answer for an email that is already an
account (a token that can never be confirmed, and a notice to the owner of the email, who is the only one
who can read it), and asking for a new code for it looks the same too. An unfinished sign-up with the same
email is started again (its details are replaced, which is safe: it was never usable, and the codes go to
the mailbox). Nothing here logs a password, a code, a token, an address or a number. Every function waits
on the database or an outside service, so they are async (decision 11); `signup_is_open` is plain `def`.
"""

import logging
import math
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlmodel.ext.asyncio.session import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.config import settings
from app.core.passwords import check_password
from app.core.rate_limit import (
    signup_code_failure_limiter,
    signup_email_limiter,
    sms_code_limiter,
)
from app.core.security import (
    EMAIL_CODE_LIFETIME,
    EMAIL_CONFIRM_PURPOSE,
    PHONE_CODE_LIFETIME,
    PHONE_CONFIRM_PURPOSE,
    ChallengeClaims,
    InvalidTokenError,
    code_matches,
    create_code_token,
    decode_code_token,
    generate_login_code,
    hash_password,
)
from app.integrations.resend import EmailNotConfiguredError, EmailSendError, mask_email
from app.integrations.termii import SmsSendError, mask_phone, send_sms
from app.models import User
from app.models.base import ApprovalStatus, Role
from app.repositories import audit_repository, user_repository
from app.schemas.signup import SignupRequest
from app.services import account_mail_service, staff_alert_service
from app.services.auth_service import (
    CodeNotSentError,
    CodeTooSoonError,
    TooManyCodesError,
    phone_must_be_confirmed,
)

logger = logging.getLogger(__name__)

MIN_SECONDS_BETWEEN_CODES = 60  # the same wait as at login (FR-57)
UNCONFIRMED_KEPT_DAYS = 7  # decision D8


class SignupClosedError(Exception):
    """Sign-up is not open: the setting is off, or Resend or Termii is not set up outside development."""


class TooManySignupsError(Exception):
    """Three sign-up attempts with this email in the last hour. The route answers 429."""


class SignupEmailNotSentError(Exception):
    """Resend did not accept the email with the code. Nothing was made. The route answers 502."""


class InvalidSignupCodeError(Exception):
    """The token or the code is wrong, expired, used, or made for something else. The route answers 401."""


class SignupLockedError(Exception):
    """Ten wrong codes in the last hour for this account. `seconds_left` is how long until it may try."""

    def __init__(self, seconds_left: int) -> None:
        super().__init__(seconds_left)
        self.seconds_left = seconds_left


@dataclass(frozen=True)
class NextStep:
    """What the person needs for the next code: its token and where the code went (masked)."""

    confirm_token: str
    sent_to: str


@dataclass(frozen=True)
class EmailConfirmed:
    """After the email code: the phone code that was texted (Termii live), or the outcome (no Termii)."""

    phone_step: NextStep | None
    outcome: str | None  # "active" or "waiting_for_approval" when the sign-up is finished


def signup_is_open() -> bool:
    """Sign-up is closed unless the setting is on; outside development it also needs Resend, because a code
    that cannot be sent cannot be confirmed, and an account that nobody can use must not be made (decision
    D2). Termii is not needed: without it the phone is confirmed by an admin's call (decision D20)."""
    if not settings.signup_enabled:
        return False
    if settings.app_env == "development":
        return True
    return bool(settings.resend_api_key and settings.resend_from_email)


def _role_for(account_type: str) -> Role:
    """A staff sign-up is made a verifier (the lowest role) and can do nothing until approved (D6)."""
    return Role.provider if account_type == "provider" else Role.verifier


def _is_an_account(user: User) -> bool:
    """A confirmed email makes it an account, whatever its phone: without Termii the phone waits for a call
    (D20), and restarting such an account would replace the password of a usable one."""
    return user.email_verified_at is not None


async def _use_a_code(session: AsyncSession, key: str) -> None:
    """Counts one code (email or SMS) for the account; 5 in an hour at most, the first one included (FR-57).

    Over the limit, whatever was changed in this request is undone before the error goes up."""
    if not sms_code_limiter.allow(key):
        await session.rollback()
        raise TooManyCodesError(sms_code_limiter.retry_after_seconds(key))


def _ensure_not_locked(user: User) -> None:
    seconds_left = signup_code_failure_limiter.retry_after_seconds(f"signupcode:{user.id}")
    if seconds_left > 0:
        raise SignupLockedError(seconds_left)


def _wrong_code(user: User) -> InvalidSignupCodeError:
    signup_code_failure_limiter.allow(f"signupcode:{user.id}")
    return InvalidSignupCodeError()


async def _send_email_code(session: AsyncSession, user: User, moment: datetime) -> str:
    """Emails a new code and returns its token. If the email cannot be sent, nothing is kept."""
    code = generate_login_code()
    try:
        await account_mail_service.send_email_code(user.email, code, EMAIL_CONFIRM_PURPOSE)
    except EmailNotConfiguredError:
        await session.rollback()
        raise SignupClosedError from None
    except EmailSendError:
        await session.rollback()
        raise SignupEmailNotSentError from None
    return create_code_token(user.id, code, EMAIL_CONFIRM_PURPOSE, EMAIL_CODE_LIFETIME, sent_at=moment)


async def _send_phone_code(session: AsyncSession, user: User, moment: datetime) -> NextStep:
    """Texts a new code to the phone. If the SMS cannot be sent, nothing is kept (the step can be retried)."""
    await _use_a_code(session, f"sms:{user.id}")
    code = generate_login_code()
    try:
        await send_sms(
            user.phone,
            f"Your SwiftHealth Route code to confirm your phone is {code}. It works for 5 minutes.",
        )
    except SmsSendError:
        await session.rollback()
        raise CodeNotSentError from None
    token = create_code_token(user.id, code, PHONE_CONFIRM_PURPOSE, PHONE_CODE_LIFETIME, sent_at=moment)
    return NextStep(confirm_token=token, sent_to=mask_phone(user.phone))


def _decoy_token(user: User, moment: datetime) -> str:
    """A token for an account that already exists: signed like the others, for a code that was never sent."""
    return create_code_token(
        user.id, generate_login_code(), EMAIL_CONFIRM_PURPOSE, EMAIL_CODE_LIFETIME, sent_at=moment
    )


async def start_signup(session: AsyncSession, payload: SignupRequest, moment: datetime) -> NextStep:
    """Makes the account and emails the first code (an existing account's email gets the same answer)."""
    if not signup_is_open():
        raise SignupClosedError
    if not signup_email_limiter.allow(f"signup:{payload.email}"):
        raise TooManySignupsError  # counts a new email and an existing one alike, so it tells nothing
    role = _role_for(payload.account_type)
    check_password(payload.password, role, payload.email)  # PasswordRuleError: the route answers 422
    # run_in_threadpool (Starlette): Argon2 is slow CPU work. Also done for an existing email.
    password_hash = await run_in_threadpool(hash_password, payload.password)
    sent_to = mask_email(payload.email)
    existing = await user_repository.get_by_email(session, payload.email)

    if existing is not None and _is_an_account(existing):
        await _use_a_code(session, f"mail:{existing.id}")
        try:
            await account_mail_service.send_account_exists_notice(existing.email)
        except EmailSendError:
            logger.warning("The notice to an existing account could not be sent.")
        return NextStep(confirm_token=_decoy_token(existing, moment), sent_to=sent_to)

    staff = payload.account_type == "staff"
    approval = ApprovalStatus.pending.value if staff else ApprovalStatus.approved.value
    note = payload.note if staff else None
    if existing is None:
        user = await user_repository.create(
            session,
            name=payload.name,
            email=payload.email,
            phone=payload.phone,
            password_hash=password_hash,
            role=role,
            confirmed=False,
            approval_status=approval,
            signup_note=note,
        )
    else:  # an unfinished sign-up with this email: start again with the new details
        user = existing
        user.name, user.phone, user.password_hash, user.role = (
            payload.name,
            payload.phone,
            password_hash,
            role,
        )
        user.approval_status, user.signup_note = approval, note
        user.email_verified_at = user.phone_verified_at = None
        user.created_at = moment  # the 7 days before it is deleted start again
        await user_repository.save(session, user)
    await _use_a_code(session, f"mail:{user.id}")
    new_token = await _send_email_code(session, user, moment)
    await session.commit()
    return NextStep(confirm_token=new_token, sent_to=sent_to)


def _claims(token: str, purpose: str) -> ChallengeClaims:
    try:
        return decode_code_token(token, purpose)
    except InvalidTokenError:
        raise InvalidSignupCodeError from None


async def _finish(session: AsyncSession, user: User, moment: datetime) -> str:
    """The last confirmation is done: writes the audit entry and tells the admins about a staff sign-up.
    Returns "active" or "waiting_for_approval"."""
    waiting = user.approval_status != ApprovalStatus.approved.value
    applicant = user.name  # read before the commit: nothing is read from the row after it
    phone_confirmed = user.phone_verified_at is not None
    await audit_repository.add_entry(
        session,
        user_id=user.id,
        listing_id=None,
        action="signup_confirmed",
        field_changed="account",
        new_value=f"{user.role.value} ({user.approval_status})",
        changed_at=moment,
    )
    await session.commit()
    if waiting:
        await staff_alert_service.alert_staff_signup_waiting(session, applicant, phone_confirmed)
    return "waiting_for_approval" if waiting else "active"


async def confirm_email(session: AsyncSession, token: str, code: str, moment: datetime) -> EmailConfirmed:
    """The code of the email is right: the email is confirmed. With Termii live a code is texted to the phone;
    without it the sign-up is finished and the phone waits for an admin's call (decision D20)."""
    claims = _claims(token, EMAIL_CONFIRM_PURPOSE)
    user = await user_repository.get_by_id(session, claims.user_id)
    if user is None or user.email_verified_at is not None:  # unknown, or already confirmed (a decoy)
        raise InvalidSignupCodeError
    _ensure_not_locked(user)
    if not code_matches(user.id, code, claims.code_hash):
        raise _wrong_code(user)
    user.email_verified_at = moment
    await user_repository.save(session, user)
    if not phone_must_be_confirmed():
        return EmailConfirmed(phone_step=None, outcome=await _finish(session, user, moment))
    # If the SMS cannot be sent, all is undone: the email stays unconfirmed and the code can be retried.
    step = await _send_phone_code(session, user, moment)
    await session.commit()
    return EmailConfirmed(phone_step=step, outcome=None)


async def confirm_phone(session: AsyncSession, token: str, code: str, moment: datetime) -> str:
    """The code of the phone is right: the account is confirmed. "active" or "waiting_for_approval"."""
    claims = _claims(token, PHONE_CONFIRM_PURPOSE)
    user = await user_repository.get_by_id(session, claims.user_id)
    if user is None or user.email_verified_at is None or user.phone_verified_at is not None:
        raise InvalidSignupCodeError
    _ensure_not_locked(user)
    if not code_matches(user.id, code, claims.code_hash):
        raise _wrong_code(user)
    user.phone_verified_at = moment
    await user_repository.save(session, user)
    return await _finish(session, user, moment)


async def resend_code(session: AsyncSession, token: str, moment: datetime) -> NextStep:
    """A new code for the step of the token (email or phone): 60 s after the last, 5 an hour at most."""
    if not signup_is_open():
        raise SignupClosedError
    try:
        claims, purpose = decode_code_token(token, EMAIL_CONFIRM_PURPOSE), EMAIL_CONFIRM_PURPOSE
    except InvalidTokenError:
        claims, purpose = _claims(token, PHONE_CONFIRM_PURPOSE), PHONE_CONFIRM_PURPOSE
    user = await user_repository.get_by_id(session, claims.user_id)
    if user is None:
        raise InvalidSignupCodeError
    seconds_since_sent = max((moment - claims.sent_at).total_seconds(), 0)
    if seconds_since_sent < MIN_SECONDS_BETWEEN_CODES:
        raise CodeTooSoonError(math.ceil(MIN_SECONDS_BETWEEN_CODES - seconds_since_sent))

    if purpose == EMAIL_CONFIRM_PURPOSE:
        await _use_a_code(session, f"mail:{user.id}")
        if user.email_verified_at is not None:  # an existing account's decoy: same answer, nothing is sent
            return NextStep(confirm_token=_decoy_token(user, moment), sent_to=mask_email(user.email))
        new_token = await _send_email_code(session, user, moment)
        await session.commit()
        return NextStep(confirm_token=new_token, sent_to=mask_email(user.email))

    if user.email_verified_at is None or user.phone_verified_at is not None:
        raise InvalidSignupCodeError
    step = await _send_phone_code(session, user, moment)
    await session.commit()
    return step


async def purge_unconfirmed(session: AsyncSession, moment: datetime) -> int:
    """Deletes accounts whose email was never confirmed in 7 days, or whose phone was not while Termii is
    live (decisions D8 and D20). Returns how many.

    The only deletion of an account in the whole plan, and only of one that can do nothing and that no
    other row names. Without Termii the phone waits for an admin's call, so it does not count.
    """
    stale = await user_repository.list_stale_unconfirmed_without_records(
        session, moment - timedelta(days=UNCONFIRMED_KEPT_DAYS), phone_counts=phone_must_be_confirmed()
    )
    for user in stale:
        await session.delete(user)
    await session.commit()
    return len(stale)
