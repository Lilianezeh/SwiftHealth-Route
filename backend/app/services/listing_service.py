"""The public listing page: one published listing with everything a visitor needs before they go.
Requirements: FR-09, FR-10, FR-11, FR-13, FR-47, US-06, US-07, FR-08, FR-22.

Decisions 1 to 10 in specs/2026-10-11-listing-detail-api/requirements.md. The rules for "open now", the next
opening or closing time and the report window are the ones of search (`services/hours.py`,
`services/search_service.py`), so the card in a search result and this page cannot disagree. No HTTP here: a
listing that is missing or not published raises `ListingNotFoundError`, and the route turns it into a 404.
"""
from collections.abc import Sequence
from datetime import datetime

from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import OpeningHours, PhoneNumber, Service
from app.repositories import listing_repository
from app.repositories.listing_repository import ListingDetailRows
from app.schemas.listing import CategorySummary, ListingDetail, OpeningHoursRead, PhoneRead, ServiceRead
from app.services.hours import has_usable_times, hours_note, is_open_at
from app.services.search_service import REPORT_WINDOW, REPORTS_TO_EXCLUDE

# FR-13
DISCLAIMER = (
    "SwiftHealth is a directory and does not give medical advice. "
    "Fees are estimates; confirm with the facility."
)
DAYS_IN_A_WEEK = 7


class ListingNotFoundError(Exception):
    """No listing has this slug, or it is not published. The public cannot tell the two apart."""


def hours_of_the_week(rows: Sequence[OpeningHours]) -> list[OpeningHoursRead]:
    """Always 7 entries, Monday first. A day with no row, or no usable times, or marked closed, is closed."""
    week: list[OpeningHoursRead] = []
    for day in range(DAYS_IN_A_WEEK):
        rows_of_the_day = [row for row in rows if row.day_of_week == day]
        row = min(rows_of_the_day, key=lambda candidate: candidate.id or 0) if rows_of_the_day else None
        if row is not None and has_usable_times(row):
            week.append(
                OpeningHoursRead(
                    day_of_week=day,
                    opens_at=row.opens_at.strftime("%H:%M"),
                    closes_at=row.closes_at.strftime("%H:%M"),
                    is_closed=False,
                )
            )
        else:
            week.append(OpeningHoursRead(day_of_week=day, opens_at=None, closes_at=None, is_closed=True))
    return week


def phones_primary_first(phones: Sequence[PhoneNumber]) -> list[PhoneNumber]:
    """The first primary number (by id) first, then every other number in the order it was added."""
    in_order = sorted(phones, key=lambda phone: phone.id or 0)
    first_primary = next((phone for phone in in_order if phone.is_primary), None)
    if first_primary is None:
        return in_order
    return [first_primary, *(phone for phone in in_order if phone is not first_primary)]


def services_by_name(services: Sequence[Service]) -> list[ServiceRead]:
    """Sorted by name ignoring case, then by id. Fees are sent as stored: a missing maximum is not made up."""
    in_order = sorted(services, key=lambda service: (service.name.casefold(), service.id or 0))
    return [
        ServiceRead(
            name=service.name,
            fee_min_naira=service.fee_min_naira,
            fee_max_naira=service.fee_max_naira,
            fee_collected_at=service.fee_collected_at,
        )
        for service in in_order
    ]


def to_detail(rows: ListingDetailRows, *, recently_reported: bool, moment: datetime) -> ListingDetail:
    """Builds the answer from the rows. Pure: `moment` is passed in, the clock is never read here."""
    listing = rows.listing
    phones = phones_primary_first(rows.phones)
    primary_phone = phones[0].number if phones and phones[0].is_primary else None
    return ListingDetail(
        id=listing.id,
        slug=listing.slug,
        name=listing.name,
        category=CategorySummary(slug=rows.category.slug, name=rows.category.name),
        area=listing.area,
        address=listing.address,
        latitude=listing.latitude,
        longitude=listing.longitude,
        distance_km=None,  # the call carries no position
        is_open_now=is_open_at(rows.opening_hours, listing.is_24_hours, moment),
        is_24_hours=listing.is_24_hours,
        primary_phone=primary_phone,
        last_verified_at=listing.last_verified_at,
        # The same rule as a search result (FR-08): overdue but still published, so shown with the label.
        verification_due=listing.next_check_due is not None and listing.next_check_due < moment,
        sponsored=False,
        hours_note=hours_note(rows.opening_hours, listing.is_24_hours, moment),
        landmark=listing.landmark,
        description=listing.description,
        entrance_photo_url=listing.entrance_photo_url,
        phones=[
            PhoneRead(number=phone.number, label=phone.label, is_primary=phone.is_primary,
                      is_whatsapp=phone.is_whatsapp)
            for phone in phones
        ],
        opening_hours=hours_of_the_week(rows.opening_hours),
        services=services_by_name(rows.services),
        recently_reported_not_working=recently_reported,
        disclaimer=DISCLAIMER,
    )


async def get_published_listing(session: AsyncSession, slug: str, moment: datetime) -> ListingDetail:
    """The listing page for a slug. Raises ListingNotFoundError if there is no published listing with it."""
    rows = await listing_repository.get_published_detail_by_slug(session, slug)
    if rows is None:
        raise ListingNotFoundError(slug)
    recently_reported = await listing_repository.is_reported_not_working(
        session, rows.listing.id, reports_since=moment - REPORT_WINDOW, reports_to_flag=REPORTS_TO_EXCLUDE
    )
    return to_detail(rows, recently_reported=recently_reported, moment=moment)
