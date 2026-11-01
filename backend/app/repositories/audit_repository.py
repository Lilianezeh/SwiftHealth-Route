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


ADDRESS_FIELDS = ("address", "area", "landmark")


async def list_address_history(session: AsyncSession, listing_id: int) -> list[tuple[AuditEntry, str | None]]:
    """The changes of a listing's address, area and landmark with the name of who made each: the `move`
    rows of accounts phase 8a and the older plain `update` rows of the same fields. Newest day first; the
    rows of one move keep the order they were written in (FR-53)."""
    query = (
        select(AuditEntry, User.name)
        .outerjoin(User, col(User.id) == col(AuditEntry.user_id))
        .where(
            col(AuditEntry.listing_id) == listing_id,
            col(AuditEntry.action).in_(("move", "update")),
            col(AuditEntry.field_changed).in_(ADDRESS_FIELDS),
        )
        .order_by(col(AuditEntry.changed_at).desc(), col(AuditEntry.id))
    )
    return [(entry, name) for entry, name in (await session.exec(query)).all()]


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


OWNER_FEE_PREFIX = "SO-"  # the Paystack references of the owner fee (specs/2026-10-29-owner-fee/)
REFUND_ACTION = "refund"  # a payment given back; `reference` is the reference of the payment
REFUND_PENDING_ACTION = "refund_pending"  # a refund Paystack did not accept yet; the nightly job asks again
# One reminder email. `reference` names the link, the end date and the day count, so none is sent twice.
REMINDER_ACTION = "owner_fee_reminder"


async def list_owner_fee_payments(session: AsyncSession, listing_ids: set[int]) -> list[AuditEntry]:
    """The owner-fee payments on these listings, newest first. The caller keeps those of its own links."""
    if not listing_ids:
        return []
    query = (
        select(AuditEntry)
        .where(
            AuditEntry.action == PAYMENT_ACTION,
            col(AuditEntry.reference).startswith(OWNER_FEE_PREFIX),
            col(AuditEntry.listing_id).in_(listing_ids),
        )
        .order_by(col(AuditEntry.id).desc())
    )
    return list((await session.exec(query)).all())


async def latest_owner_fee_payment(session: AsyncSession, link_id: int) -> AuditEntry | None:
    """The newest payment of this link (its reference is `SO-<link id>-<digits>`), or None."""
    query = (
        select(AuditEntry)
        .where(AuditEntry.action == PAYMENT_ACTION, col(AuditEntry.reference).startswith(f"SO-{link_id}-"))
        .order_by(col(AuditEntry.id).desc())
        .limit(1)
    )
    return (await session.exec(query)).first()


async def find_by_action_and_reference(
    session: AsyncSession, action: str, reference: str
) -> AuditEntry | None:
    query = select(AuditEntry).where(AuditEntry.action == action, AuditEntry.reference == reference).limit(1)
    return (await session.exec(query)).first()


async def list_refunds_to_retry(session: AsyncSession) -> list[AuditEntry]:
    """The refunds that were asked for and not done: a `refund_pending` entry with no `refund` entry for the
    same payment reference."""
    done = select(AuditEntry.reference).where(AuditEntry.action == REFUND_ACTION)
    query = (
        select(AuditEntry)
        .where(AuditEntry.action == REFUND_PENDING_ACTION, col(AuditEntry.reference).not_in(done))
        .order_by(col(AuditEntry.id))
    )
    return list((await session.exec(query)).all())


async def latest_new_value(session: AsyncSession, listing_id: int, action: str) -> str | None:
    """The `new_value` of the newest entry of this action for a listing, or None (decision C6)."""
    query = (
        select(AuditEntry.new_value)
        .where(AuditEntry.listing_id == listing_id, AuditEntry.action == action)
        .order_by(col(AuditEntry.id).desc())
    )
    return (await session.exec(query)).first()
