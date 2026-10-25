"""The admin manages staff and provider accounts. Requirements: FR-41, FR-38, NFR-06, NFR-07.
Decision C10 in specs/2026-10-20-staff-screens/requirements.md.

Passwords are hashed in a thread (Argon2 is slow CPU work, CLAUDE.md) and are never returned, logged
or written in an audit entry: the entry says only "changed". A phone number is personal data too, so
its entry also says only "changed". An admin cannot lock themselves out: no self-deactivation and no
taking their own admin role away.
"""

from datetime import datetime

from sqlmodel.ext.asyncio.session import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.passwords import check_password
from app.core.security import hash_password
from app.models import User
from app.models.base import Role
from app.repositories import audit_repository, listing_repository, user_repository
from app.schemas.admin_user import AdminUserCreate, AdminUserList, AdminUserUpdate
from app.schemas.auth import UserRead

CHANGED = "changed"


class EmailTakenError(Exception):
    """Another user already has this email."""


class UserNotFoundError(Exception):
    """No user has this id."""


class SelfLockoutError(Exception):
    """An admin tried to deactivate themselves or give up their own admin role."""


class EmailNotConfirmedError(Exception):
    """The email of the account is not confirmed yet, so its phone cannot be confirmed by a call."""


class NoPhoneError(Exception):
    """The account has no phone number to confirm."""


class NotAProviderError(Exception):
    """A listing can only be linked to a user whose role is provider."""


class ListingNotFoundError(Exception):
    """No listing has this id."""


class ListingAlreadyOwnedError(Exception):
    """The listing already belongs to another user."""


class NewPasswordNeededError(Exception):
    """A provider is being made staff without a new password (FR-56): a provider's password may be shorter."""


async def list_users(session: AsyncSession) -> AdminUserList:
    users = await user_repository.list_all(session)
    return AdminUserList(items=[UserRead.model_validate(user) for user in users], total=len(users))


async def create_user(
    session: AsyncSession, admin: User, payload: AdminUserCreate, moment: datetime
) -> UserRead:
    check_password(payload.password, payload.role, payload.email)  # PasswordRuleError: the route answers 422
    if await user_repository.get_by_email(session, payload.email) is not None:
        raise EmailTakenError
    # run_in_threadpool (Starlette): Argon2 is slow CPU work, so it runs in a thread, off the event loop.
    password_hash = await run_in_threadpool(hash_password, payload.password)
    user = await user_repository.create(
        session,
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        password_hash=password_hash,
        role=payload.role,
    )
    await audit_repository.add_entry(
        session,
        user_id=admin.id,
        listing_id=None,
        action="user_create",
        field_changed="user",
        new_value=f"{payload.email} ({payload.role.value})",
        changed_at=moment,
    )
    await session.commit()
    return UserRead.model_validate(user)


def _active_text(value: bool) -> str:
    return "true" if value else "false"


async def update_user(
    session: AsyncSession, admin: User, user_id: int, payload: AdminUserUpdate, moment: datetime
) -> UserRead:
    user = await user_repository.get_by_id(session, user_id)
    if user is None:
        raise UserNotFoundError(user_id)
    if user.id == admin.id:
        if payload.is_active is False or (payload.role is not None and payload.role != Role.admin):
            raise SelfLockoutError

    # The password rule (FR-56) is checked for the role the account will have, before anything is changed.
    new_role = payload.role if payload.role is not None else user.role
    if user.role == Role.provider and new_role != Role.provider and payload.password is None:
        raise NewPasswordNeededError
    if payload.password is not None:
        check_password(payload.password, new_role, user.email)

    changes: list[tuple[str, str | None, str | None, int | None]] = []  # field, old, new, listing id
    if payload.name is not None and payload.name != user.name:
        changes.append(("name", user.name, payload.name, None))
        user.name = payload.name
    if payload.phone is not None and payload.phone != user.phone:
        changes.append(("phone", None, CHANGED, None))
        user.phone = payload.phone
    if payload.role is not None and payload.role != user.role:
        changes.append(("role", user.role.value, payload.role.value, None))
        user.role = payload.role
    if payload.is_active is not None and payload.is_active != user.is_active:
        changes.append(("is_active", _active_text(user.is_active), _active_text(payload.is_active), None))
        user.is_active = payload.is_active
    if payload.password is not None:
        user.password_hash = await run_in_threadpool(hash_password, payload.password)
        changes.append(("password", None, CHANGED, None))

    if payload.listing_id is not None:
        if user.role != Role.provider:
            raise NotAProviderError
        listing = await listing_repository.get_by_id(session, payload.listing_id)
        if listing is None:
            raise ListingNotFoundError(payload.listing_id)
        if listing.owner_id is not None and listing.owner_id != user.id:
            raise ListingAlreadyOwnedError
        if listing.owner_id != user.id:
            listing.owner_id = user.id
            listing.updated_at = moment
            session.add(listing)
            changes.append(("owner_id", None, str(user.id), listing.id))

    await user_repository.save(session, user)
    for field, old_value, new_value, listing_id in changes:
        await audit_repository.add_entry(
            session,
            user_id=admin.id,
            listing_id=listing_id,
            action="user_update",
            field_changed=field,
            old_value=old_value,
            new_value=new_value,
            changed_at=moment,
        )
    await session.commit()
    return UserRead.model_validate(user)


async def confirm_phone_by_call(session: AsyncSession, admin: User, user_id: int, moment: datetime) -> None:
    """The admin phoned the person at the number on the account and heard them confirm it (decision D20).

    Used when Termii is off, so no SMS code could confirm the phone. It confirms nothing else and approves
    nothing. Asking again for a phone that is already confirmed changes nothing and writes no second entry.
    The audit entry names the account, never the number (NDPA data minimisation).
    """
    user = await user_repository.get_by_id(session, user_id)
    if user is None:
        raise UserNotFoundError
    if user.phone_verified_at is not None:
        return
    if user.email_verified_at is None:
        raise EmailNotConfirmedError
    if not user.phone:
        raise NoPhoneError
    user.phone_verified_at = moment
    await user_repository.save(session, user)
    await audit_repository.add_entry(
        session,
        user_id=admin.id,
        listing_id=None,
        action="phone_confirmed_by_call",
        field_changed="phone",
        new_value=f"confirmed for user {user.id}",
        changed_at=moment,
    )
    await session.commit()
