"""The authenticator app: set up, use at login, switch off, new backup codes, reset. FR-58, NFR-06, NFR-07.
Spec: specs/2026-10-23-accounts-and-facility-ownership/ (Phase 2c); owner's answers D17 to D19 (2026-10-24).

No HTTP here: the routes turn these domain errors into status codes. The secret is made here, stored
encrypted (core/secret_box.py) and shown once, at the start of the set-up; the app is switched on only
when the first code from it is right, which is also when the ten backup codes are made. A code from the
app works once (the step is kept), a backup code works once (its hash is removed), and after 10 wrong
codes in an hour the second step of that account is locked for the rest of the hour (the admins are told
by email). The audit entries say only "on", "off", "reset" and "new codes": never a secret or a code.
Every function that waits on the database is async; the code checks are plain `def` (CPU only).
"""

import logging
from dataclasses import dataclass
from datetime import datetime

from sqlmodel.ext.asyncio.session import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core import secret_box, totp
from app.core.rate_limit import totp_failure_limiter
from app.core.security import verify_password
from app.models import User
from app.repositories import audit_repository, user_repository
from app.services import staff_alert_service

logger = logging.getLogger(__name__)

APP_CODE = "app"
BACKUP_CODE = "backup"


class TwoFactorUnavailableError(Exception):
    """There is no usable encryption key (or the stored secret cannot be read with it)."""


class WrongPasswordError(Exception):
    """The password typed again is not the person's password."""


class WrongCodeError(Exception):
    """The code (from the app, or a backup code) is wrong, already used, or not in the allowed 30 seconds."""


class LockedError(Exception):
    """Ten wrong codes in the last hour: no more tries until `seconds_left` has passed."""

    def __init__(self, seconds_left: int) -> None:
        super().__init__(seconds_left)
        self.seconds_left = seconds_left


class AlreadyOnError(Exception):
    """The app is already switched on."""


class NotOnError(Exception):
    """The app is not switched on, so there is nothing to switch off or renew."""


class NothingStartedError(Exception):
    """A first code was sent but no set-up was started."""


class SelfResetError(Exception):
    """An admin tried to reset their own two-step login: another admin must do it."""


class UserNotFoundError(Exception):
    """No user has this id."""


@dataclass(frozen=True)
class SetupStarted:
    secret: str  # shown once, for typing into the app
    otpauth_uri: str  # what the QR code holds


@dataclass(frozen=True)
class TwoFactorStatus:
    enabled: bool
    backup_codes_left: int
    available: bool  # false: no usable encryption key here, so the set-up says "not available yet"


def status_of(user: User) -> TwoFactorStatus:
    left = len(totp.load_hashes(user.backup_code_hashes)) if user.two_factor_enabled else 0
    return TwoFactorStatus(
        enabled=user.two_factor_enabled, backup_codes_left=left, available=secret_box.is_available()
    )


def _failure_key(user: User) -> str:
    return f"totp:{user.id}"


def _ensure_not_locked(user: User) -> None:
    seconds_left = totp_failure_limiter.retry_after_seconds(_failure_key(user))
    if seconds_left > 0:
        raise LockedError(seconds_left)


async def _record_failure(session: AsyncSession, user: User) -> None:
    """Counts one wrong code. The caller checked that the account was not locked, so the one wrong code that
    makes it locked is the tenth: that one tells the admins (best effort)."""
    key = _failure_key(user)
    totp_failure_limiter.allow(key)
    if totp_failure_limiter.retry_after_seconds(key) > 0:
        await staff_alert_service.alert_two_factor_locked(session, user.name)


def _secret_of(user: User) -> str:
    if user.totp_secret is None:
        raise NothingStartedError
    try:
        return secret_box.decrypt(user.totp_secret)
    except (secret_box.SecretBoxUnavailableError, secret_box.SecretBoxError):
        raise TwoFactorUnavailableError from None


def _accept_code(user: User, typed: str, moment: datetime) -> str | None:
    """Checks a code from the app or a backup code. On success it changes the user (the step or the hashes).

    A code of six digits is an app code; any other shape is tried as a backup code, which needs no secret,
    so a person whose key is lost can still use their backup codes.
    """
    if totp.looks_like_app_code(typed):
        step = totp.check_code(_secret_of(user), totp.normalise_code(typed), user.totp_last_step, moment)
        if step is None:
            return None
        user.totp_last_step = step
        return APP_CODE
    remaining = totp.use_backup_code(user.backup_code_hashes, typed)
    if remaining is None:
        return None
    user.backup_code_hashes = remaining
    return BACKUP_CODE


async def check_second_factor(session: AsyncSession, user: User, typed: str, moment: datetime) -> str:
    """The login's second step, and the check of switching off or renewing: a right code, within the limit.

    Returns "app" or "backup" and leaves the changed user in the session (the caller commits). Raises
    LockedError, WrongCodeError (after counting it) or TwoFactorUnavailableError.
    """
    _ensure_not_locked(user)
    accepted = _accept_code(user, typed, moment)
    if accepted is None:
        await _record_failure(session, user)
        raise WrongCodeError
    if accepted == BACKUP_CODE:
        await audit_repository.add_entry(
            session,
            user_id=user.id,
            listing_id=None,
            action="two_factor_backup_used",
            field_changed="two_factor",
            new_value=f"{len(totp.load_hashes(user.backup_code_hashes))} left",
            changed_at=moment,
        )
    session.add(user)
    return accepted


async def _check_password(user: User, password: str) -> None:
    # run_in_threadpool (Starlette): Argon2 is slow CPU work, so it runs in a thread, off the event loop.
    if not await run_in_threadpool(verify_password, password, user.password_hash):
        raise WrongPasswordError


def _clear(user: User) -> None:
    user.totp_secret = None
    user.totp_enabled_at = None
    user.totp_last_step = None
    user.backup_code_hashes = None


async def start_setup(session: AsyncSession, user: User, password: str) -> SetupStarted:
    """Makes a new secret (replacing an unfinished one), stores it encrypted, and returns it once."""
    if not secret_box.is_available():
        raise TwoFactorUnavailableError
    if user.two_factor_enabled:
        raise AlreadyOnError
    await _check_password(user, password)
    secret = totp.new_secret()
    _clear(user)
    user.totp_secret = secret_box.encrypt(secret)
    await user_repository.save(session, user)
    await session.commit()
    return SetupStarted(secret=secret, otpauth_uri=totp.otpauth_uri(secret, user.email))


async def confirm_setup(session: AsyncSession, user: User, typed: str, moment: datetime) -> list[str]:
    """Switches the app on if the first code is right; returns the ten backup codes, this once."""
    if user.two_factor_enabled:
        raise AlreadyOnError
    if user.totp_secret is None:
        raise NothingStartedError
    _ensure_not_locked(user)
    step = totp.check_code(_secret_of(user), totp.normalise_code(typed), None, moment)
    if step is None:
        await _record_failure(session, user)
        raise WrongCodeError
    codes = totp.new_backup_codes()
    user.totp_enabled_at = moment
    user.totp_last_step = step
    user.backup_code_hashes = totp.hash_backup_codes(codes)
    await user_repository.save(session, user)
    await audit_repository.add_entry(
        session, user_id=user.id, listing_id=None, action="two_factor_on", field_changed="two_factor",
        new_value="on", changed_at=moment,
    )
    await session.commit()
    return codes


async def disable(session: AsyncSession, user: User, password: str, typed: str, moment: datetime) -> None:
    """Switches the app off: needs the password and a code (from the app, or a backup code)."""
    if not user.two_factor_enabled:
        raise NotOnError
    await _check_password(user, password)
    await check_second_factor(session, user, typed, moment)
    _clear(user)
    await user_repository.save(session, user)
    await audit_repository.add_entry(
        session, user_id=user.id, listing_id=None, action="two_factor_off", field_changed="two_factor",
        new_value="off", changed_at=moment,
    )
    await session.commit()


async def renew_backup_codes(
    session: AsyncSession, user: User, password: str, typed: str, moment: datetime
) -> list[str]:
    """Ten new backup codes (the old ones stop working): needs the password and a code."""
    if not user.two_factor_enabled:
        raise NotOnError
    await _check_password(user, password)
    await check_second_factor(session, user, typed, moment)
    codes = totp.new_backup_codes()
    user.backup_code_hashes = totp.hash_backup_codes(codes)
    await user_repository.save(session, user)
    await audit_repository.add_entry(
        session, user_id=user.id, listing_id=None, action="two_factor_codes", field_changed="two_factor",
        new_value="new codes", changed_at=moment,
    )
    await session.commit()
    return codes


async def admin_reset(session: AsyncSession, admin: User, user_id: int, moment: datetime) -> None:
    """Clears another account's app and backup codes (lost phone). Never one's own: another admin does it."""
    if user_id == admin.id:
        raise SelfResetError
    user = await user_repository.get_by_id(session, user_id)
    if user is None:
        raise UserNotFoundError
    _clear(user)
    await user_repository.save(session, user)
    await audit_repository.add_entry(
        session, user_id=admin.id, listing_id=None, action="two_factor_reset", field_changed="two_factor",
        new_value=f"reset for user {user.id}", changed_at=moment,
    )
    await session.commit()


async def reset_by_email(session: AsyncSession, email: str, moment: datetime) -> bool:
    """The start-up step for the only admin: clears the app of the account with this email; False if none."""
    user = await user_repository.get_by_email(session, email.strip().lower())
    if user is None:
        return False
    _clear(user)
    await user_repository.save(session, user)
    await audit_repository.add_entry(
        session, user_id=user.id, listing_id=None, action="two_factor_reset", field_changed="two_factor",
        new_value="reset", reference="startup-reset", changed_at=moment,
    )
    await session.commit()
    return True
