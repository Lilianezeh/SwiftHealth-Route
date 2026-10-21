"""What staff see and change of listings. Requirements: FR-31, FR-38, FR-42, NFR-06.
Decisions C1 to C6 in specs/2026-10-20-staff-screens/requirements.md.

Reading: the staff list and the staff detail of any status. Writing (create and edit) is below. No HTTP
here: the routes turn the domain errors into status codes. Who may edit which listing is `access_service`.
"""

import re
from datetime import datetime, time, timedelta

from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import DEFAULT_MAP_CENTRE
from app.models import Listing, OpeningHours, PhoneNumber, Service, User
from app.models.base import ListingStatus
from app.repositories import audit_repository, category_repository, listing_repository, search_repository
from app.schemas.staff_listing import (
    DueFilter,
    HoursInput,
    ListingCreate,
    ListingUpdate,
    PhoneInput,
    ServiceInput,
    StaffListingDetail,
    StaffListingList,
    StaffListingSummary,
    StaffListParams,
)
from app.services import listing_service
from app.services.hours import is_open_at
from app.services.search_service import REPORT_WINDOW, REPORTS_TO_EXCLUDE, to_summary

SUBMISSION_ACTION = (
    "submission"  # the audit entry that holds a "List your facility" form's contact details (C6)
)
THIS_WEEK = timedelta(days=7)


class ListingNotFoundError(Exception):
    """No listing has this id."""


def is_default_pin(latitude: float, longitude: float) -> bool:
    return (latitude, longitude) == DEFAULT_MAP_CENTRE


async def list_listings(
    session: AsyncSession, user: User, params: StaffListParams, moment: datetime
) -> StaffListingList:
    """One page of listings of every status. `moment` is passed in (never read from the clock here)."""
    due_before = due_after = None
    if params.due == DueFilter.overdue:
        due_before = moment
    elif params.due == DueFilter.this_week:
        due_after, due_before = moment, moment + THIS_WEEK
    rows, total = await listing_repository.list_for_staff(
        session,
        status=params.status,
        category_slug=params.category,
        area=params.area,
        name_contains=params.search_text,
        due_after=due_after,
        due_before=due_before,
        created_by=user.id if params.mine else None,
        limit=params.limit,
        offset=params.offset,
    )
    items = []
    for candidate in await search_repository.candidates_from_rows(session, rows):
        listing = candidate.listing
        is_open = is_open_at(candidate.opening_hours, listing.is_24_hours, moment)
        summary = to_summary(candidate, None, is_open, moment)
        items.append(
            StaffListingSummary(
                **summary.model_dump(),
                status=listing.status,
                next_check_due=listing.next_check_due,
                created_by=listing.created_by,
            )
        )
    return StaffListingList(items=items, total=total)


async def get_staff_detail(session: AsyncSession, listing_id: int, moment: datetime) -> StaffListingDetail:
    """The detail of a listing of any status, with the fields only staff see."""
    rows = await listing_repository.get_detail_by_id(session, listing_id)
    if rows is None:
        raise ListingNotFoundError(listing_id)
    listing = rows.listing
    recently_reported = await listing_repository.is_reported_not_working(
        session, listing.id, reports_since=moment - REPORT_WINDOW, reports_to_flag=REPORTS_TO_EXCLUDE
    )
    public = listing_service.to_detail(rows, recently_reported=recently_reported, moment=moment)
    return StaffListingDetail(
        **public.model_dump(),
        status=listing.status,
        next_check_due=listing.next_check_due,
        owner_id=listing.owner_id,
        created_by=listing.created_by,
        featured_until=listing.featured_until,
        map_pin_is_default=is_default_pin(listing.latitude, listing.longitude),
        submission_details=await audit_repository.latest_new_value(session, listing.id, SUBMISSION_ACTION),
    )


class UnknownCategoryError(Exception):
    """The category slug does not exist. The route answers 422."""


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "listing"


async def unique_slug(session: AsyncSession, name: str, area: str) -> str:
    """Name plus area as a slug; `-2`, `-3`... are added while it is taken (api-spec, POST /listings)."""
    base = slugify(f"{name} {area}")
    slug, number = base, 1
    while await listing_repository.slug_exists(session, slug):
        number += 1
        slug = f"{base}-{number}"
    return slug


def phone_rows(phones: list[PhoneInput]) -> list[PhoneNumber]:
    return [
        PhoneNumber(
            listing_id=0, number=p.number, label=p.label, is_primary=p.is_primary, is_whatsapp=p.is_whatsapp
        )
        for p in phones
    ]


def hours_rows(hours: list[HoursInput]) -> list[OpeningHours]:
    return [
        OpeningHours(
            listing_id=0,
            day_of_week=h.day_of_week,
            opens_at=h.opens_at,
            closes_at=h.closes_at,
            is_closed=h.is_closed,
        )
        for h in hours
    ]


def service_rows(services: list[ServiceInput]) -> list[Service]:
    return [
        Service(
            listing_id=0,
            name=s.name,
            fee_min_naira=s.fee_min_naira,
            fee_max_naira=s.fee_max_naira,
            fee_collected_at=s.fee_collected_at,
        )
        for s in services
    ]


async def create_listing(session: AsyncSession, user: User, payload: ListingCreate, moment: datetime) -> int:
    """Creates a draft owned by `user` (FR-31): its phones, hours, services and a `create` audit entry."""
    category = await category_repository.get_by_slug(session, payload.category)
    if category is None:
        raise UnknownCategoryError(payload.category)
    listing = Listing(
        slug=await unique_slug(session, payload.name, payload.area),
        name=payload.name,
        category_id=category.id,
        area=payload.area,
        address=payload.address,
        landmark=payload.landmark,
        latitude=payload.latitude,
        longitude=payload.longitude,
        description=payload.description,
        status=ListingStatus.draft,
        is_24_hours=payload.is_24_hours,
        created_by=user.id,
        created_at=moment,
        updated_at=moment,
    )
    await listing_repository.add_listing_with_details(
        session,
        listing,
        phone_rows(payload.phones),
        hours_rows(payload.opening_hours),
        service_rows(payload.services),
    )
    await audit_repository.add_entry(
        session, user_id=user.id, listing_id=listing.id, action="create", changed_at=moment
    )
    await session.commit()
    return listing.id


def _text(value: object) -> str | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def _hhmm(value: time | None) -> str:
    return value.strftime("%H:%M") if value else "-"


def describe_phones(phones: list[tuple]) -> str:
    descriptions = []
    for number, label, primary, whatsapp in phones:
        parts = [label, "primary" if primary else None, "WhatsApp" if whatsapp else None]
        descriptions.append(f"{number} ({', '.join(part for part in parts if part)})")
    return "; ".join(descriptions)


def describe_hours(hours: list[tuple]) -> str:
    return "; ".join(
        f"day {day}: closed" if closed else f"day {day}: {opens}-{closes}"
        for day, opens, closes, closed in hours
    )


def describe_services(services: list[tuple]) -> str:
    return "; ".join(
        f"{name} {low or '-'}-{high or '-'} {collected or '-'}" for name, low, high, collected in services
    )


async def update_listing(
    session: AsyncSession,
    user: User,
    listing: Listing,
    payload: ListingUpdate,
    moment: datetime,
    *,
    urgent_recheck_fields: frozenset[str] = frozenset(),
    recheck_reference: str | None = None,
) -> None:
    """Applies the fields that were sent and writes one audit entry per changed field (FR-31, FR-38).

    `listing` was loaded and checked by the caller (`access_service`). A value equal to the stored one
    writes nothing. If a field in `urgent_recheck_fields` really changed (a provider's phones or hours,
    FR-43), `next_check_due` is set to `moment` and one more audit entry is written, in the same save.
    """
    rows = await listing_repository.get_detail_by_id(session, listing.id)
    changes: list[tuple[str, str | None, str | None]] = []

    for field in (
        "name",
        "area",
        "address",
        "landmark",
        "latitude",
        "longitude",
        "description",
        "is_24_hours",
    ):
        if field in payload.model_fields_set:
            new_value = getattr(payload, field)
            old_value = getattr(listing, field)
            if new_value != old_value:
                setattr(listing, field, new_value)
                changes.append((field, _text(old_value), _text(new_value)))

    if "category" in payload.model_fields_set and payload.category != rows.category.slug:
        category = await category_repository.get_by_slug(session, payload.category)
        if category is None:
            raise UnknownCategoryError(payload.category)
        listing.category_id = category.id
        changes.append(("category", rows.category.slug, category.slug))

    new_phones = old_phones = new_hours = old_hours = new_services = old_services = None
    if payload.phones is not None:
        old_phones = [(p.number, p.label, p.is_primary, p.is_whatsapp) for p in rows.phones]
        new_phones = [(p.number, p.label, p.is_primary, p.is_whatsapp) for p in payload.phones]
    if payload.opening_hours is not None:
        old_hours = sorted(
            (h.day_of_week, _hhmm(h.opens_at), _hhmm(h.closes_at), h.is_closed) for h in rows.opening_hours
        )
        new_hours = sorted(
            (h.day_of_week, _hhmm(h.opens_at), _hhmm(h.closes_at), h.is_closed) for h in payload.opening_hours
        )
    if payload.services is not None:
        old_services = sorted(
            (s.name, _text(s.fee_min_naira), _text(s.fee_max_naira), _text(s.fee_collected_at))
            for s in rows.services
        )
        new_services = sorted(
            (s.name, _text(s.fee_min_naira), _text(s.fee_max_naira), _text(s.fee_collected_at))
            for s in payload.services
        )

    replace_phones = new_phones is not None and new_phones != old_phones
    replace_hours = new_hours is not None and new_hours != old_hours
    replace_services = new_services is not None and new_services != old_services
    await listing_repository.replace_children(
        session,
        listing.id,
        phones=phone_rows(payload.phones) if replace_phones else None,
        opening_hours=hours_rows(payload.opening_hours) if replace_hours else None,
        services=service_rows(payload.services) if replace_services else None,
    )
    if replace_phones:
        changes.append(("phones", describe_phones(old_phones), describe_phones(new_phones)))
    if replace_hours:
        changes.append(("opening_hours", describe_hours(old_hours), describe_hours(new_hours)))
    if replace_services:
        changes.append(("services", describe_services(old_services), describe_services(new_services)))

    if changes:
        listing.updated_at = moment
        session.add(listing)
        for field, old_value, new_value in changes:
            await audit_repository.add_entry(
                session,
                user_id=user.id,
                listing_id=listing.id,
                action="update",
                field_changed=field,
                old_value=old_value,
                new_value=new_value,
                changed_at=moment,
            )
        if urgent_recheck_fields & {field for field, _old, _new in changes}:
            old_due = listing.next_check_due
            listing.next_check_due = moment
            await audit_repository.add_entry(
                session,
                user_id=user.id,
                listing_id=listing.id,
                action="update",
                field_changed="next_check_due",
                old_value=_text(old_due.isoformat() if old_due else None),
                new_value=moment.isoformat(),
                reference=recheck_reference,
                changed_at=moment,
            )
    await session.commit()
