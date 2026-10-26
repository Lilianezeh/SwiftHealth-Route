from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import ColumnElement, and_, func, or_
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
from app.repositories.search_repository import flagged_listing_ids, text_matches

# Only these listings are a re-check job; a draft, a pending or a hidden one is not (decision H6).
RECHECK_STATUSES = (ListingStatus.published, ListingStatus.recheck_due)


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
    return await _load_detail_rows(session, listing, category)


async def get_detail_by_id(session: AsyncSession, listing_id: int) -> ListingDetailRows | None:
    """The detail of one listing of any status, for staff. The route decides who may call it."""
    found = (
        await session.exec(
            select(Listing, Category)
            .join(Category, col(Category.id) == Listing.category_id)
            .where(Listing.id == listing_id)
        )
    ).first()
    if found is None:
        return None
    return await _load_detail_rows(session, found[0], found[1])


async def _load_detail_rows(
    session: AsyncSession, listing: Listing, category: Category
) -> ListingDetailRows:
    """The phones, the hours and the services of a listing: three queries, however many rows there are."""
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


async def list_for_staff(
    session: AsyncSession,
    *,
    status: ListingStatus | None,
    category_slug: str | None,
    area: str | None,
    name_contains: str | None,
    due_after: datetime | None,
    due_before: datetime | None,
    created_by: int | None,
    limit: int,
    offset: int,
) -> tuple[list[tuple[Listing, Category]], int]:
    """One page of listings of every status for the staff list, with the total. Sorted by name, then id.

    `due_before` alone means overdue (the check date has passed); with `due_after` it is a window. Either
    one counts only the listings of RECHECK_STATUSES, so the list agrees with the dashboard numbers.
    """
    conditions = []
    if status is not None:
        conditions.append(Listing.status == status)
    if due_before is not None or due_after is not None:
        conditions.append(col(Listing.status).in_(RECHECK_STATUSES))
    if category_slug is not None:
        conditions.append(Category.slug == category_slug)
    if area is not None:
        conditions.append(Listing.area == area)
    if name_contains is not None:
        escaped = name_contains.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        conditions.append(col(Listing.name).ilike(f"%{escaped}%", escape="\\"))
    if due_before is not None:
        conditions.append(col(Listing.next_check_due).is_not(None))
        conditions.append(col(Listing.next_check_due) < due_before)
    if due_after is not None:
        conditions.append(col(Listing.next_check_due) >= due_after)
    if created_by is not None:
        conditions.append(Listing.created_by == created_by)
    joined = (
        select(Listing, Category).join(Category, col(Category.id) == Listing.category_id).where(*conditions)
    )
    total = (
        await session.exec(
            select(func.count())
            .select_from(Listing)
            .join(Category, col(Category.id) == Listing.category_id)
            .where(*conditions)
        )
    ).one()
    page = (
        await session.exec(joined.order_by(col(Listing.name), col(Listing.id)).offset(offset).limit(limit))
    ).all()
    return [(listing, category) for listing, category in page], total


async def get_by_owner_id(session: AsyncSession, owner_id: int) -> Listing | None:
    """The listing a provider owns (the lowest id if an admin linked more than one), or None."""
    query = select(Listing).where(Listing.owner_id == owner_id).order_by(col(Listing.id)).limit(1)
    return (await session.exec(query)).first()


async def find_overdue_published(session: AsyncSession, moment: datetime) -> list[Listing]:
    """Published listings whose `next_check_due` has passed, by name then id (the nightly job, FR-33)."""
    query = (
        select(Listing)
        .where(
            Listing.status == ListingStatus.published,
            col(Listing.next_check_due).is_not(None),
            col(Listing.next_check_due) < moment,
        )
        .order_by(col(Listing.name), col(Listing.id))
    )
    return list((await session.exec(query)).all())


async def slug_exists(session: AsyncSession, slug: str) -> bool:
    return (await session.exec(select(Listing.id).where(Listing.slug == slug))).first() is not None


async def find_by_phone_number(session: AsyncSession, number: str) -> Listing | None:
    """A listing of ANY status that has this phone number (already in the +234 form). Duplicate check, D15."""
    query = (
        select(Listing)
        .join(PhoneNumber, col(PhoneNumber.listing_id) == col(Listing.id))
        .where(col(PhoneNumber.number) == number)
        .order_by(col(Listing.id))
        .limit(1)
    )
    return (await session.exec(query)).first()


async def find_similar_name_in_area(
    session: AsyncSession, name: str, area: str, minimum_similarity: float
) -> Listing | None:
    """The most similar listing of ANY status in the area, if its name is at least `minimum_similarity` like
    `name` (pg_trgm `similarity`, the whole name against the whole name). Duplicate check, D15."""
    similarity = func.similarity(col(Listing.name), name)
    query = (
        select(Listing)
        .where(col(Listing.area) == area, similarity >= minimum_similarity)
        .order_by(similarity.desc(), col(Listing.id))
        .limit(1)
    )
    return (await session.exec(query)).first()


async def search_claimable(
    session: AsyncSession, search_text: str, match_threshold: float, limit: int
) -> list[tuple[Listing, Category]]:
    """Published and re-check-due listings whose name or area resembles `search_text`, best name match first.

    The whole text may match, or (for 2 or more words) every word may, like the public search. Never a draft,
    a pending or a hidden listing."""
    words = search_text.split()
    whole_text = _name_or_area_matches(search_text, match_threshold)
    matches = whole_text
    if len(words) > 1:
        every_word = and_(*(_name_or_area_matches(word, match_threshold) for word in words))
        matches = or_(whole_text, every_word)
    best_name_first = func.word_similarity(search_text, col(Listing.name)).desc()
    query = (
        select(Listing, Category)
        .join(Category, col(Category.id) == col(Listing.category_id))
        .where(col(Listing.status).in_(RECHECK_STATUSES), matches)
        .order_by(best_name_first, col(Listing.name), col(Listing.id))
        .limit(limit)
    )
    return [(listing, category) for listing, category in (await session.exec(query)).all()]


def _name_or_area_matches(text: str, match_threshold: float) -> ColumnElement[bool]:
    return or_(
        text_matches(text, col(Listing.name), match_threshold),
        text_matches(text, col(Listing.area), match_threshold),
    )


async def replace_children(
    session: AsyncSession,
    listing_id: int,
    *,
    phones: list[PhoneNumber] | None = None,
    opening_hours: list[OpeningHours] | None = None,
    services: list[Service] | None = None,
) -> None:
    """Replaces the phones, hours or services of a listing with the new rows. None is left alone.

    The caller commits, so the old rows go and the new ones come in the same transaction.
    """
    for model, rows in ((PhoneNumber, phones), (OpeningHours, opening_hours), (Service, services)):
        if rows is None:
            continue
        await session.exec(delete(model).where(col(model.listing_id) == listing_id))
        for row in rows:
            row.listing_id = listing_id
            session.add(row)
    await session.flush()


async def mark_primary_phone_working(session: AsyncSession, listing_id: int, moment: datetime) -> None:
    """A passing check says the primary number worked at `moment`. Other numbers are left alone (FR-32)."""
    phones = (
        await session.exec(
            select(PhoneNumber).where(
                PhoneNumber.listing_id == listing_id, col(PhoneNumber.is_primary).is_(True)
            )
        )
    ).all()
    for phone in phones:
        phone.last_working_at = moment
        session.add(phone)
    await session.flush()


async def existing_name_area_pairs(session: AsyncSession) -> set[tuple[str, str]]:
    """The (name, area) of every listing of any status, lower-cased, so an import can skip one that exists."""
    rows = (await session.exec(select(Listing.name, Listing.area))).all()
    return {(name.casefold(), area.casefold()) for name, area in rows}


async def list_all_with_primary_phone(session: AsyncSession) -> list[tuple[Listing, Category, str | None]]:
    """Every listing of any status with its category and primary number, by name then id (CSV export)."""
    rows = (
        await session.exec(
            select(Listing, Category)
            .join(Category, col(Category.id) == Listing.category_id)
            .order_by(col(Listing.name), col(Listing.id))
        )
    ).all()
    phones = (
        await session.exec(
            select(PhoneNumber).where(col(PhoneNumber.is_primary).is_(True)).order_by(col(PhoneNumber.id))
        )
    ).all()
    primary_by_listing: dict[int, str] = {}
    for phone in phones:
        primary_by_listing.setdefault(phone.listing_id, phone.number)  # the first primary, like the page
    return [(listing, category, primary_by_listing.get(listing.id)) for listing, category in rows]
