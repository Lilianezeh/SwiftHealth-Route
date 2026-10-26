"""The admin decides on accounts: approve, reject, suspend, reactivate.
Requirements: FR-49, FR-55, FR-38, US-18, NFR-06, NFR-07.
Spec: specs/backend/api-spec.md section 11, "Phase 4a"; decisions D6 and D20 of
specs/2026-10-23-accounts-and-facility-ownership/.

A staff sign-up is `pending` and can do nothing. The admin approves it as an editor or a verifier (never an
admin or a provider) once its email and phone are confirmed (the phone by SMS or by the admin's call, D20),
or rejects it. A suspended account is refused on its next request (`get_current_user` reads `is_active` on
every request). Nothing is ever deleted. Every change writes audit entries that name the account in
`reference` as `user:{id}` and never hold a password, a number or an address. The person gets an email after
the decision is saved; a failure to send it is logged without the address and changes nothing.
"""

import logging
from datetime import datetime

from sqlmodel.ext.asyncio.session import AsyncSession

from app.integrations.resend import EmailSendError
from app.models import User
from app.models.base import ApprovalStatus, Role
from app.repositories import audit_repository, user_repository
from app.services import account_mail_service
from app.services.admin_user_service import SelfLockoutError, UserNotFoundError

logger = logging.getLogger(__name__)

__all__ = [
    "AlreadySuspendedError",
    "ClosedAccountError",
    "EmailNotConfirmedError",
    "LastAdminError",
    "NotPendingError",
    "NotSuspendedError",
    "PhoneNotConfirmedError",
    "SelfLockoutError",
    "UserNotFoundError",
    "approve",
    "reactivate",
    "reject",
    "suspend",
]


class NotPendingError(Exception):
    """The account is not waiting for approval."""


class EmailNotConfirmedError(Exception):
    """The email of the account is not confirmed yet."""


class PhoneNotConfirmedError(Exception):
    """The phone of the account is not confirmed (no SMS code, no recorded call)."""


class AlreadySuspendedError(Exception):
    """The account is already suspended."""


class NotSuspendedError(Exception):
    """The account is not suspended, or it cannot be brought back (rejected or closed)."""


class ClosedAccountError(Exception):
    """The person closed the account: its row stays, but nothing more is done to it."""


class LastAdminError(Exception):
    """The account is the last active admin: it must stay, so nobody can lock the admins out."""


async def _load(session: AsyncSession, user_id: int) -> User:
    user = await user_repository.get_by_id(session, user_id)
    if user is None:
        raise UserNotFoundError(user_id)
    return user


async def _write(
    session: AsyncSession,
    admin_id: int | None,
    action: str,
    target_id: int,
    field: str,
    old: str | None,
    new: str | None,
    moment: datetime,
) -> None:
    await audit_repository.add_entry(
        session,
        user_id=admin_id,
        listing_id=None,
        action=action,
        field_changed=field,
        old_value=old,
        new_value=new,
        reference=f"user:{target_id}",
        changed_at=moment,
    )


async def _tell(email: str, decision: str, detail: str | None) -> None:
    """Emails the person after the commit. Never raises: the decision is saved whatever happens here."""
    try:
        await account_mail_service.send_decision_notice(email, decision, detail)
    except EmailSendError:
        logger.warning("The %s notice to an account could not be sent.", decision)  # no address in the log


async def approve(session: AsyncSession, admin: User, user_id: int, role: Role, moment: datetime) -> User:
    user = await _load(session, user_id)
    if user.approval_status != ApprovalStatus.pending.value:
        raise NotPendingError
    if user.email_verified_at is None:
        raise EmailNotConfirmedError
    if user.phone_verified_at is None:
        raise PhoneNotConfirmedError
    old_role = user.role
    user.approval_status = ApprovalStatus.approved.value
    user.role = role
    await user_repository.save(session, user)
    await _write(session, admin.id, "user_approve", user.id, "approval_status", "pending", "approved", moment)
    if old_role != role:
        await _write(session, admin.id, "user_update", user.id, "role", old_role.value, role.value, moment)
    email = user.email  # read before the commit
    await session.commit()
    await _tell(email, "approved", role.value)
    return user


async def reject(
    session: AsyncSession, admin: User, user_id: int, reason: str | None, moment: datetime
) -> User:
    user = await _load(session, user_id)
    if user.approval_status != ApprovalStatus.pending.value:
        raise NotPendingError
    user.approval_status = ApprovalStatus.rejected.value
    await user_repository.save(session, user)
    await _write(session, admin.id, "user_reject", user.id, "approval_status", "pending", "rejected", moment)
    if reason:
        await _write(session, admin.id, "user_reject", user.id, "reason", None, reason, moment)
    email = user.email
    await session.commit()
    await _tell(email, "rejected", reason)
    return user


async def suspend(
    session: AsyncSession, caller_id: int | None, user_id: int, reason: str, moment: datetime
) -> User:
    """Turns an account off. `caller_id` is the admin's own id (None: no caller to compare, so only the
    last-admin rule runs)."""
    user = await _load(session, user_id)
    if caller_id is not None and caller_id == user.id:
        raise SelfLockoutError
    if user.closed_at is not None:
        raise ClosedAccountError
    if not user.is_active:
        raise AlreadySuspendedError
    if user.role == Role.admin and await user_repository.count_other_active_admins(session, user.id) == 0:
        raise LastAdminError
    user.is_active = False
    await user_repository.save(session, user)
    await _write(session, caller_id, "user_suspend", user.id, "is_active", "true", "false", moment)
    await _write(session, caller_id, "user_suspend", user.id, "reason", None, reason, moment)
    email = user.email
    await session.commit()
    await _tell(email, "suspended", reason)
    return user


async def reactivate(session: AsyncSession, admin: User, user_id: int, moment: datetime) -> User:
    user = await _load(session, user_id)
    cannot_come_back = user.closed_at is not None or user.approval_status != ApprovalStatus.approved.value
    if user.is_active or cannot_come_back:
        raise NotSuspendedError
    user.is_active = True
    await user_repository.save(session, user)
    await _write(session, admin.id, "user_reactivate", user.id, "is_active", "false", "true", moment)
    email = user.email
    await session.commit()
    await _tell(email, "reactivated", None)
    return user
