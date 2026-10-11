from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import func
from sqlmodel import col, delete, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import (
    AuditEntry,
    Category,
    Listing,
    OpeningHours,
    PhoneNumber,
    Service,
    UserReport,
    VerificationCheck,
)
from app.models.base import CheckMethod, CheckResult, ListingStatus
from app.repositories.search_repository import flagged_listing_ids


@dataclass
class ListingDetailRows:
    """A published listing and the rows that belong to it, as the database holds them (FR-09)."""

    listing: Listing
    category: Category
    phones: list[PhoneNumber]  # in the order they were added (by id)
    opening_hours: list[OpeningHours]  # by day of the week, Monday first
    services: list[Service]  # in the order they were added (by id)


async def get_by_id(session: AsyncSession, listing_id: int) -> Listing | None:
    return await session.get(Listing, listing_id)


async def get_by_slug(session: AsyncSession, slug: str) -> Listing | None:
    return (await session.exec(select(Listing).where(Listing.slug == slug))).first()


async def get_published_detail_by_slug(session: AsyncSession, slug: str) -> ListingDetailRows | None:
    """The public detail of one listing, or None if no published listing has exactly this slug.

    The status check is here, in the query, so no caller can forget it: a draft, a pending, a hidden and a
    re-check-due listing are all "not found" (api-spec, trust rule 1). Four queries, however many phones or
    services there are: the listing with its category, then the phones, the hours and the services.
    """
    found = (
        await session.exec(
            select(Listing, Category)
            .join(Category, col(Category.id) == Listing.category_id)
            .where(Listing.slug == slug, Listing.status == ListingStatus.published)
        )
    ).first()
    if found is None:
        return None
    listing, category = found
    phones = (
        await session.exec(
            select(PhoneNumber).where(PhoneNumber.listing_id == listing.id).order_by(col(PhoneNumber.id))
        )
    ).all()
    opening_hours = (
        await session.exec(
            select(OpeningHours)
            .where(OpeningHours.listing_id == listing.id)
            .order_by(col(OpeningHours.day_of_week), col(OpeningHours.id))
        )
    ).all()
    services = (
        await session.exec(
            select(Service).where(Service.listing_id == listing.id).order_by(col(Service.id))
        )
    ).all()
    return ListingDetailRows(
        listing=listing,
        category=category,
        phones=list(phones),
        opening_hours=list(opening_hours),
        services=list(services),
    )


async def is_reported_not_working(
    session: AsyncSession, listing_id: int, *, reports_since: datetime, reports_to_flag: int
) -> bool:
    """True when enough different reporters called this listing "not working" since `reports_since`.

    This is the FR-22 rule. It is the query that hides a listing from search
    (`search_repository.flagged_listing_ids`), limited to this one listing, so the detail page and the
    search results cannot disagree. Phase 9 moves it to a report repository.
    """
    query = flagged_listing_ids(reports_since, reports_to_flag).where(UserReport.listing_id == listing_id)
    return (await session.exec(query)).first() is not None


async def add_listing_with_details(
    session: AsyncSession,
    listing: Listing,
    phones: list[PhoneNumber],
    opening_hours: list[OpeningHours],
    services: list[Service],
) -> Listing:
    """Adds a listing and its phones, hours and services together. The caller commits."""
    session.add(listing)
    await session.flush()  # gives the listing an id for the child rows
    for child in (*phones, *opening_hours, *services):
        child.listing_id = listing.id
        session.add(child)
    await session.flush()
    return listing


async def count_by_slugs(session: AsyncSession, slugs: Sequence[str]) -> int:
    query = select(func.count()).select_from(Listing).where(col(Listing.slug).in_(slugs))
    return (await session.exec(query)).one()


async def delete_by_slugs(session: AsyncSession, slugs: Sequence[str]) -> dict[str, int]:
    """Deletes the listings with exactly these slugs and every row that belongs to them. The caller commits.

    Children go first (they point at the listing). Returns how many rows were deleted per table.
    """
    listing_ids = list((await session.exec(select(Listing.id).where(col(Listing.slug).in_(slugs)))).all())
    deleted = {
        "user_reports": 0, "audit_entries": 0, "verification_checks": 0, "services": 0, "opening_hours": 0,
        "phone_numbers": 0, "listings": 0,
    }
    if not listing_ids:
        return deleted
    for table_name, model, id_column in (
        ("user_reports", UserReport, UserReport.listing_id),
        ("audit_entries", AuditEntry, AuditEntry.listing_id),
        ("verification_checks", VerificationCheck, VerificationCheck.listing_id),
        ("services", Service, Service.listing_id),
        ("opening_hours", OpeningHours, OpeningHours.listing_id),
        ("phone_numbers", PhoneNumber, PhoneNumber.listing_id),
        ("listings", Listing, Listing.id),
    ):
        result = await session.exec(delete(model).where(col(id_column).in_(listing_ids)))
        deleted[table_name] = result.rowcount
    return deleted


async def add_verification_check(
    session: AsyncSession,
    *,
    listing_id: int,
    staff_id: int,
    method: CheckMethod,
    result: CheckResult,
    person_reached: str | None,
    notes: str | None,
    checked_at: datetime,
) -> VerificationCheck:
    check = VerificationCheck(
        listing_id=listing_id, staff_id=staff_id, method=method, result=result,
        person_reached=person_reached, notes=notes, checked_at=checked_at,
    )
    session.add(check)
    await session.flush()
    return check
