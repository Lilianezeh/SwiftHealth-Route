"""The only code that reads and writes the owner links (`facility_owners`).
Requirements: FR-50, US-19, NFR-06.
Accounts phase 6a. A link is one row per (listing, person); its `status` is pending, approved or removed.
"""

from datetime import datetime

from sqlalchemy import func
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import Category, FacilityOwner, Listing, PhoneNumber, User
from app.models.base import LinkStatus, OwnerRole

LinkWithListing = tuple[FacilityOwner, Listing, Category]
PendingRow = tuple[FacilityOwner, User, Listing]


async def get_by_id(session: AsyncSession, link_id: int) -> FacilityOwner | None:
    return (await session.exec(select(FacilityOwner).where(col(FacilityOwner.id) == link_id))).first()


async def get_for(session: AsyncSession, listing_id: int, user_id: int) -> FacilityOwner | None:
    query = select(FacilityOwner).where(
        col(FacilityOwner.listing_id) == listing_id, col(FacilityOwner.user_id) == user_id
    )
    return (await session.exec(query)).first()


async def has_approved_link(session: AsyncSession, listing_id: int, user_id: int) -> bool:
    """One query: may this person edit this listing through a link?"""
    query = select(func.count()).select_from(FacilityOwner).where(
        col(FacilityOwner.listing_id) == listing_id,
        col(FacilityOwner.user_id) == user_id,
        col(FacilityOwner.status) == LinkStatus.approved.value,
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
        .where(
            col(FacilityOwner.user_id) == user_id,
            col(FacilityOwner.status) == LinkStatus.approved.value,
        )
        .order_by(col(FacilityOwner.listing_id))
    )
    if owner_only:
        query = query.where(col(FacilityOwner.role) == OwnerRole.owner.value)
    first = (await session.exec(query.limit(1))).first()
    return (first[0], first[1]) if first else None


async def approved_link_for(
    session: AsyncSession, user_id: int, listing_id: int
) -> tuple[FacilityOwner, Listing] | None:
    query = (
        select(FacilityOwner, Listing)
        .join(Listing, col(Listing.id) == col(FacilityOwner.listing_id))
        .where(
            col(FacilityOwner.user_id) == user_id,
            col(FacilityOwner.listing_id) == listing_id,
            col(FacilityOwner.status) == LinkStatus.approved.value,
        )
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
    session: AsyncSession, listing_id: int, user_id: int, role: str, moment: datetime
) -> FacilityOwner:
    """Asks for a link. A link that waits or is approved is left as it is. A removed one is set back to
    `pending` (the same row: the audit log keeps the history). The caller commits."""
    link = await get_for(session, listing_id, user_id)
    if link is None:
        link = FacilityOwner(
            listing_id=listing_id, user_id=user_id, role=role,
            status=LinkStatus.pending.value, requested_at=moment,
        )
    elif link.status == LinkStatus.removed.value:
        link.status, link.role, link.requested_at = LinkStatus.pending.value, role, moment
        link.approved_by = link.approved_at = link.removed_by = link.removed_at = link.note = None
    else:
        return link
    session.add(link)
    await session.flush()
    return link


async def add_approved(
    session: AsyncSession, listing_id: int, user_id: int, approved_by: int, moment: datetime, note: str | None
) -> FacilityOwner:
    """An approved `owner` link made by an admin. A link that exists is made approved. The caller commits."""
    link = await get_for(session, listing_id, user_id)
    if link is None:
        link = FacilityOwner(listing_id=listing_id, user_id=user_id, requested_at=moment)
    link.role, link.status = OwnerRole.owner.value, LinkStatus.approved.value
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
