from datetime import datetime

from sqlalchemy import exists, func, or_
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import AuditEntry, Listing, User, UserReport, VerificationCheck
from app.models.base import ApprovalStatus, Role, utcnow


async def get_by_email(session: AsyncSession, email: str) -> User | None:
    return (await session.exec(select(User).where(User.email == email))).first()


async def get_by_id(session: AsyncSession, user_id: int) -> User | None:
    return await session.get(User, user_id)


async def set_last_login(session: AsyncSession, user: User, logged_in_at: datetime) -> None:
    """Records the login time and flushes. The caller commits."""
    user.last_login_at = logged_in_at
    session.add(user)
    await session.flush()


async def create(
    session: AsyncSession,
    *,
    name: str,
    email: str,
    phone: str | None,
    password_hash: str,
    role: Role,
    confirmed: bool = True,
    approval_status: str = ApprovalStatus.approved.value,
    signup_note: str | None = None,
) -> User:
    """Adds the user and flushes so it has an id. The caller commits.

    An account made by an admin, the seed or the first-admin command is `confirmed` (the admin typed
    the email and the phone) and approved. Sign-up passes `confirmed=False`, and
    `approval_status="pending"` and a `signup_note` for staff.
    """
    confirmed_at = utcnow() if confirmed else None
    user = User(
        name=name,
        email=email,
        phone=phone,
        password_hash=password_hash,
        role=role,
        approval_status=approval_status,
        email_verified_at=confirmed_at,
        phone_verified_at=confirmed_at,
        signup_note=signup_note,
    )
    session.add(user)
    await session.flush()
    return user


async def list_stale_unconfirmed_without_records(
    session: AsyncSession, created_before: datetime, *, phone_counts: bool
) -> list[User]:
    """Accounts made before `created_before`, email never confirmed (or phone, when `phone_counts`), that
    no other row points to.

    They can do nothing, so keeping their personal data helps nobody (NDPA, data minimisation). An account
    named in an audit entry, a listing, a report or a check is never in this list, so deleting these
    breaks no row.
    """
    named_somewhere = or_(
        exists().where(col(AuditEntry.user_id) == col(User.id)),
        exists().where(col(Listing.owner_id) == col(User.id)),
        exists().where(col(Listing.created_by) == col(User.id)),
        exists().where(col(UserReport.resolved_by) == col(User.id)),
        exists().where(col(VerificationCheck.staff_id) == col(User.id)),
    )
    unconfirmed = col(User.email_verified_at).is_(None)
    if phone_counts:
        unconfirmed = or_(unconfirmed, col(User.phone_verified_at).is_(None))
    query = select(User).where(col(User.created_at) < created_before, unconfirmed, ~named_somewhere)
    return list((await session.exec(query)).all())


async def list_active_with_roles(session: AsyncSession, roles: set[Role]) -> list[User]:
    """The active users with one of the roles, oldest first. Tells staff of a flagged listing (FR-22)."""
    query = (
        select(User)
        .where(col(User.is_active).is_(True), col(User.role).in_(roles))
        .order_by(col(User.id))
    )
    return list((await session.exec(query)).all())


async def list_all(session: AsyncSession) -> list[User]:
    """Every user, by id (the admin's staff list)."""
    return list((await session.exec(select(User).order_by(col(User.id)))).all())


def _like_pattern(search_text: str) -> str:
    """The text as a 'contains' pattern in which %, _ and the backslash mean themselves."""
    escaped = search_text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


async def list_filtered(
    session: AsyncSession,
    *,
    role: Role | None,
    approval_status: str | None,
    is_active: bool | None,
    search_text: str | None,
    limit: int,
    offset: int,
) -> tuple[list[User], int]:
    """One page of accounts, by id, and how many match the filters (the admin's account list, FR-55)."""
    conditions = []
    if role is not None:
        conditions.append(col(User.role) == role)
    if approval_status is not None:
        conditions.append(col(User.approval_status) == approval_status)
    if is_active is not None:
        conditions.append(col(User.is_active).is_(is_active))
    if search_text:
        pattern = _like_pattern(search_text.strip())
        conditions.append(
            or_(col(User.name).ilike(pattern, escape="\\"), col(User.email).ilike(pattern, escape="\\"))
        )
    total = (await session.exec(select(func.count()).select_from(User).where(*conditions))).one()
    query = select(User).where(*conditions).order_by(col(User.id)).limit(limit).offset(offset)
    return list((await session.exec(query)).all()), total


async def count_other_active_admins(session: AsyncSession, excluding_user_id: int) -> int:
    """How many approved, active admins there are besides this account (the last can never be locked out)."""
    query = select(func.count()).select_from(User).where(
        col(User.role) == Role.admin,
        col(User.is_active).is_(True),
        col(User.approval_status) == ApprovalStatus.approved.value,
        col(User.closed_at).is_(None),
        col(User.id) != excluding_user_id,
    )
    return (await session.exec(query)).one()


async def names_by_ids(session: AsyncSession, user_ids: set[int]) -> dict[int, str]:
    """The name of each account, by id (for the activity log). Ids that do not exist are left out."""
    if not user_ids:
        return {}
    rows = (await session.exec(select(User.id, User.name).where(col(User.id).in_(user_ids)))).all()
    return {user_id: name for user_id, name in rows if user_id is not None}


async def save(session: AsyncSession, user: User) -> None:
    """Writes the changes of a user that was loaded from this session. The caller commits."""
    session.add(user)
    await session.flush()
