"""Small helpers that put listings, hours and reports into the test database. Requirements: US-01, FR-22.

Every function adds rows and flushes, so the rows are visible to the next query in the same session.
"""
import re
from datetime import datetime, time

from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import (
    Category,
    FacilityOwner,
    Listing,
    OpeningHours,
    PhoneNumber,
    Service,
    User,
    UserReport,
)
from app.models.base import ListingStatus, ReportReason, ReportStatus, utcnow
from app.repositories import category_repository, listing_repository

FICTIONAL_PHONE = "+2340000000001"  # +234 then a zero: never a real number


def every_day(opens_at: time, closes_at: time) -> list[OpeningHours]:
    """The same hours on all 7 days. A closing time earlier than the opening time runs past midnight."""
    return [
        OpeningHours(listing_id=0, day_of_week=day, opens_at=opens_at, closes_at=closes_at, is_closed=False)
        for day in range(7)
    ]


async def get_or_add_category(session: AsyncSession, slug: str, name: str | None = None) -> Category:
    category = await category_repository.get_by_slug(session, slug)
    if category is None:
        category = await category_repository.create(
            session, name=name or slug.title(), slug=slug, is_emergency=False, recheck_days=45
        )
    return category


async def add_listing(
    session: AsyncSession,
    name: str,
    *,
    category_slug: str = "pharmacy",
    area: str = "GRA",
    latitude: float = 6.45,
    longitude: float = 7.5,
    status: ListingStatus = ListingStatus.published,
    is_24_hours: bool = False,
    opening_hours: list[OpeningHours] | None = None,
    service_names: tuple[str, ...] = (),
    phone: str | None = FICTIONAL_PHONE,
    phones: list[PhoneNumber] | None = None,
    services: list[Service] | None = None,
    last_verified_at: datetime | None = None,
    next_check_due: datetime | None = None,
    featured_until: datetime | None = None,
) -> Listing:
    """`phones` and `services`, when given, replace `phone` and `service_names` (rows built by the test)."""
    category = await get_or_add_category(session, category_slug)
    listing = Listing(
        slug=re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-"), name=name, category_id=category.id,
        area=area, address="1 Example Road", latitude=latitude, longitude=longitude, status=status,
        is_24_hours=is_24_hours, last_verified_at=last_verified_at, next_check_due=next_check_due,
        featured_until=featured_until,
    )
    if phones is None:
        phones = [PhoneNumber(listing_id=0, number=phone, is_primary=True)] if phone else []
    if services is None:
        services = [Service(listing_id=0, name=service_name) for service_name in service_names]
    return await listing_repository.add_listing_with_details(
        session, listing, phones, opening_hours or [], services
    )


async def add_owner_link(
    session: AsyncSession,
    listing: Listing,
    user: User,
    *,
    role: str = "owner",
    status: str = "approved",
) -> FacilityOwner:
    """A link between a provider and a listing (the table `facility_owners`). An `approved` one is what lets a
    provider edit the listing; set `status` to "pending" or "removed" for the other states."""
    link = FacilityOwner(
        listing_id=listing.id, user_id=user.id, role=role, status=status,
        approved_at=utcnow() if status == "approved" else None,
    )
    session.add(link)
    await session.flush()
    return link


async def add_report(
    session: AsyncSession,
    listing: Listing,
    reporter_key: str | None,
    *,
    created_at: datetime,
    reason: ReportReason = ReportReason.not_working,
    status: ReportStatus = ReportStatus.open,
) -> UserReport:
    report = UserReport(
        listing_id=listing.id, reason=reason, status=status, reporter_key=reporter_key, created_at=created_at
    )
    session.add(report)
    await session.flush()
    return report
