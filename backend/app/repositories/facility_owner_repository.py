"""The only code that reads and writes the owner links (`facility_owners`).
Requirements: FR-50, US-19, NFR-06.
Accounts phase 6a. A link is one row per (listing, person); its `status` is pending, approved or removed.
"""

from datetime import datetime, timedelta

from sqlalchemy import ColumnElement, and_, func, or_
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.core.months import add_one_month
from app.models import Category, FacilityOwner, Listing, PhoneNumber, User
from app.models.base import LinkStatus, OwnerRole, utcnow

LinkWithListing = tuple[FacilityOwner, Listing, Category]
PendingRow = tuple[FacilityOwner, User, Listing]


async def get_by_id(session: AsyncSession, link_id: int) -> FacilityOwner | None:
    return (await session.exec(select(FacilityOwner).where(col(FacilityOwner.id) == link_id))).first()


async def get_for(session: AsyncSession, listing_id: int, user_id: int) -> FacilityOwner | None:
    query = select(FacilityOwner).where(
        col(FacilityOwner.listing_id) == listing_id, col(FacilityOwner.user_id) == user_id
    )
    return (await session.exec(query)).first()


def _link_on_listing_or_its_main_facility(listing_id: int) -> ColumnElement[bool]:
    """The link is on this listing, or on the main facility this listing is a branch of (decision D5: access
    inherits, one way). A main facility has no parent, so for it only the first part can be true."""
    parent_of_listing = select(Listing.parent_id).where(col(Listing.id) == listing_id).scalar_subquery()
    return or_(
        col(FacilityOwner.listing_id) == listing_id,
        col(FacilityOwner.listing_id) == parent_of_listing,
    )


def _link_may_manage() -> ColumnElement[bool]:
    """The owner fee as a condition: the link is `approved` and its paid month, plus the grace days,
    has not ended; or it is `ending` (cancelled) and the paid month itself has not ended. No paid date
    never gives access. `now` is read here, in the one place that decides access (the stored `lapsed`
    status is not matched at all)."""
    now = utcnow()
    grace_cutoff = now - timedelta(days=settings.owner_fee_grace_days)
    return or_(
        and_(
            col(FacilityOwner.status) == LinkStatus.approved.value,
            col(FacilityOwner.paid_until) >= grace_cutoff,
        ),
        and_(
            col(FacilityOwner.status) == LinkStatus.ending.value,
            col(FacilityOwner.paid_until) >= now,
        ),
    )


async def has_approved_link(session: AsyncSession, listing_id: int, user_id: int) -> bool:
    """One query: may this person manage this listing through a link (their own, or its main facility's)?
    Only a link whose owner fee is current counts (see `_link_may_manage`)."""
    query = select(func.count()).select_from(FacilityOwner).where(
        _link_on_listing_or_its_main_facility(listing_id),
        col(FacilityOwner.user_id) == user_id,
        _link_may_manage(),
    )
    return (await session.exec(query)).one() > 0


async def list_for_user(session: AsyncSession, user_id: int) -> list[LinkWithListing]:
    """Every link of the person, whatever its state, by listing id, with the listing and its category."""
    query = (
        select(FacilityOwner, Listing, Category)
        .join(Listing, col(Listing.id) == col(FacilityOwner.listing_id))
        .join(Category, col(Category.id) == col(Listing.category_id))
        .where(col(FacilityOwner.user_id) == user_id)
        .order_by(col(FacilityOwner.listing_id))
    )
    return [(link, listing, category) for link, listing, category in (await session.exec(query)).all()]


async def first_approved_listing(
    session: AsyncSession, user_id: int, *, owner_only: bool = False
) -> tuple[FacilityOwner, Listing] | None:
    """The approved link with the lowest listing id and its listing; only an `owner` link if asked."""
    query = (
        select(FacilityOwner, Listing)
        .join(Listing, col(Listing.id) == col(FacilityOwner.listing_id))
        .where(col(FacilityOwner.user_id) == user_id, _link_may_manage())
        .order_by(col(FacilityOwner.listing_id))
    )
    if owner_only:
        query = query.where(col(FacilityOwner.role) == OwnerRole.owner.value)
    first = (await session.exec(query.limit(1))).first()
    return (first[0], first[1]) if first else None


async def approved_link_for(
    session: AsyncSession, user_id: int, listing_id: int
) -> tuple[FacilityOwner, Listing] | None:
    """The person's approved link that gives access to the listing, and THE LISTING ASKED FOR: their own
    link on it, or (for a branch) their link on its main facility. A link of their own comes first."""
    query = (
        select(FacilityOwner, Listing)
        .join(Listing, col(Listing.id) == listing_id)
        .where(
            _link_on_listing_or_its_main_facility(listing_id),
            col(FacilityOwner.user_id) == user_id,
            _link_may_manage(),
        )
        .order_by((col(FacilityOwner.listing_id) == listing_id).desc())
    )
    first = (await session.exec(query)).first()
    return (first[0], first[1]) if first else None


async def list_pending(session: AsyncSession) -> list[PendingRow]:
    """The links that wait for staff, oldest first, with the person and the listing."""
    query = (
        select(FacilityOwner, User, Listing)
        .join(User, col(User.id) == col(FacilityOwner.user_id))
        .join(Listing, col(Listing.id) == col(FacilityOwner.listing_id))
        .where(col(FacilityOwner.status) == LinkStatus.pending.value)
        .order_by(col(FacilityOwner.requested_at), col(FacilityOwner.id))
    )
    return [(link, user, listing) for link, user, listing in (await session.exec(query)).all()]


async def list_approved_not_paid_since(session: AsyncSession, cutoff: datetime) -> list[FacilityOwner]:
    """The approved links whose paid month ended before `cutoff` (the end of the grace period): the
    nightly job moves them to `lapsed`. An approved link with no paid date counts too."""
    query = select(FacilityOwner).where(
        col(FacilityOwner.status) == LinkStatus.approved.value,
        or_(col(FacilityOwner.paid_until).is_(None), col(FacilityOwner.paid_until) < cutoff),
    )
    return list((await session.exec(query)).all())


async def list_ending_over(session: AsyncSession, moment: datetime) -> list[FacilityOwner]:
    """The cancelled links whose paid month has ended: the nightly job removes them."""
    query = select(FacilityOwner).where(
        col(FacilityOwner.status) == LinkStatus.ending.value,
        or_(col(FacilityOwner.paid_until).is_(None), col(FacilityOwner.paid_until) < moment),
    )
    return list((await session.exec(query)).all())


async def list_approved_paid_between(
    session: AsyncSession, start: datetime, end: datetime
) -> list[tuple[FacilityOwner, User, Listing]]:
    """The approved links whose paid month ends from `start` up to `end`, with the person and the listing: the
    candidates for a reminder email."""
    query = (
        select(FacilityOwner, User, Listing)
        .join(User, col(User.id) == col(FacilityOwner.user_id))
        .join(Listing, col(Listing.id) == col(FacilityOwner.listing_id))
        .where(
            col(FacilityOwner.status) == LinkStatus.approved.value,
            col(FacilityOwner.paid_until) >= start,
            col(FacilityOwner.paid_until) < end,
            col(User.is_active).is_(True),
        )
    )
    return [(link, user, listing) for link, user, listing in (await session.exec(query)).all()]


async def phones_of(session: AsyncSession, listing_ids: set[int]) -> dict[int, list[PhoneNumber]]:
    """The phone numbers of each listing (the numbers staff call), in the order they were added."""
    if not listing_ids:
        return {}
    query = (
        select(PhoneNumber)
        .where(col(PhoneNumber.listing_id).in_(listing_ids))
        .order_by(col(PhoneNumber.id))
    )
    phones: dict[int, list[PhoneNumber]] = {}
    for phone in (await session.exec(query)).all():
        phones.setdefault(phone.listing_id, []).append(phone)
    return phones


async def request_link(
    session: AsyncSession, listing_id: int, user_id: int, role: str, moment: datetime,
    reason: str | None = None,
) -> FacilityOwner:
    """Asks for a link. It starts as `awaiting_payment`: staff see it only after the first month is
    paid (owner fee). A link in any other state is left as it is. A removed one is set back to
    `awaiting_payment` (the same row: the audit log keeps the history). The caller commits.

    `reason` is the person's own words; it is kept in `note` while the link waits, and a decision by staff
    replaces it with their own note."""
    link = await get_for(session, listing_id, user_id)
    if link is None:
        link = FacilityOwner(
            listing_id=listing_id, user_id=user_id, role=role,
            status=LinkStatus.awaiting_payment.value, requested_at=moment, note=reason,
        )
    elif link.status == LinkStatus.removed.value:
        link.status, link.role, link.requested_at = LinkStatus.awaiting_payment.value, role, moment
        link.approved_by = link.approved_at = link.removed_by = link.removed_at = None
        link.paid_until = None
        link.note = reason
    else:
        return link
    session.add(link)
    await session.flush()
    return link


async def add_approved(
    session: AsyncSession, listing_id: int, user_id: int, approved_by: int, moment: datetime, note: str | None
) -> FacilityOwner:
    """An approved `owner` link made by an admin. A link that exists is made approved. The caller commits.

    An admin's link starts with a free first month (as the links that existed when the owner fee
    started), so it gives access at once; the owner pays from the second month. A link that is
    already paid keeps its date."""
    link = await get_for(session, listing_id, user_id)
    if link is None:
        link = FacilityOwner(listing_id=listing_id, user_id=user_id, requested_at=moment)
    link.role, link.status = OwnerRole.owner.value, LinkStatus.approved.value
    if link.paid_until is None or link.paid_until < moment:
        link.paid_until = add_one_month(moment)
    link.approved_by, link.approved_at, link.note = approved_by, moment, note
    link.removed_by = link.removed_at = None
    session.add(link)
    await session.flush()
    return link


async def save(session: AsyncSession, link: FacilityOwner) -> None:
    session.add(link)
    await session.flush()


async def remove_all_for_user(session: AsyncSession, user_id: int, moment: datetime) -> None:
    """Marks every link of the person that is not removed yet as removed (their account was closed)."""
    links = (
        await session.exec(
            select(FacilityOwner).where(
                col(FacilityOwner.user_id) == user_id,
                col(FacilityOwner.status) != LinkStatus.removed.value,
            )
        )
    ).all()
    for link in links:
        link.status, link.removed_at, link.removed_by = LinkStatus.removed.value, moment, user_id
        session.add(link)
    await session.flush()
