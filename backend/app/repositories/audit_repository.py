from datetime import datetime

from sqlalchemy import func
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import AuditEntry, Listing, User

PAYMENT_ACTION = "payment"  # the audit action of a confirmed Paystack payment (FR-46)


async def add_entry(
    session: AsyncSession,
    *,
    user_id: int | None,
    listing_id: int | None,
    action: str,
    field_changed: str | None = None,
    old_value: str | None = None,
    new_value: str | None = None,
    reference: str | None = None,
    changed_at: datetime | None = None,
) -> AuditEntry:
    """Adds one audit row (FR-38). The caller commits, so the entry saves with the change it describes."""
    entry = AuditEntry(
        user_id=user_id, listing_id=listing_id, action=action, field_changed=field_changed,
        old_value=old_value, new_value=new_value, reference=reference,
    )
    if changed_at is not None:
        entry.changed_at = changed_at
    session.add(entry)
    await session.flush()
    return entry


# The entry, the name of who did it, the name of the listing.
ActivityRow = tuple[AuditEntry, str | None, str | None]


async def list_activity(
    session: AsyncSession,
    *,
    user_id: int | None,
    action: str | None,
    start: datetime | None,
    end: datetime | None,
    limit: int,
    offset: int,
) -> tuple[list[ActivityRow], int]:
    """One page of the audit log, newest first, and how many entries match (the admin's activity log, FR-55).

    `start` is included and `end` is excluded (the caller turns "from day A to day B" into these two moments).
    """
    conditions = []
    if user_id is not None:
        conditions.append(col(AuditEntry.user_id) == user_id)
    if action is not None:
        conditions.append(col(AuditEntry.action) == action)
    if start is not None:
        conditions.append(col(AuditEntry.changed_at) >= start)
    if end is not None:
        conditions.append(col(AuditEntry.changed_at) < end)
    total = (await session.exec(select(func.count()).select_from(AuditEntry).where(*conditions))).one()
    query = (
        select(AuditEntry, User.name, Listing.name)
        .outerjoin(User, col(User.id) == col(AuditEntry.user_id))
        .outerjoin(Listing, col(Listing.id) == col(AuditEntry.listing_id))
        .where(*conditions)
        .order_by(col(AuditEntry.changed_at).desc(), col(AuditEntry.id).desc())
        .limit(limit)
        .offset(offset)
    )
    return [(entry, actor, listing) for entry, actor, listing in (await session.exec(query)).all()], total


async def lock_reference(session: AsyncSession, reference: str) -> None:
    """Waits for a Postgres advisory lock on this reference, held until the transaction ends (FR-46).

    Two webhooks for the same payment that arrive together then take turns, so the second one sees the first
    one's audit entry and does nothing.
    """
    await session.exec(select(func.pg_advisory_xact_lock(func.hashtext(reference))))


async def find_payment(session: AsyncSession, reference: str) -> AuditEntry | None:
    """The audit entry of the payment with this Paystack reference, or None if it was not applied (yet)."""
    query = (
        select(AuditEntry)
        .where(AuditEntry.action == PAYMENT_ACTION, AuditEntry.reference == reference)
        .order_by(col(AuditEntry.id))
        .limit(1)
    )
    return (await session.exec(query)).first()


async def latest_new_value(session: AsyncSession, listing_id: int, action: str) -> str | None:
    """The `new_value` of the newest entry of this action for a listing, or None (decision C6)."""
    query = (
        select(AuditEntry.new_value)
        .where(AuditEntry.listing_id == listing_id, AuditEntry.action == action)
        .order_by(col(AuditEntry.id).desc())
    )
    return (await session.exec(query)).first()
