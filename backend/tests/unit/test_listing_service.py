"""The listing detail answer, built from the rows of the database.
Requirements: FR-09, FR-10, FR-11, FR-13, FR-47, US-06, US-07, FR-08, FR-22.

Decisions 1 to 10 in specs/2026-10-11-listing-detail-api/requirements.md. Most tests build the rows by hand
and call the pure function `to_detail`, with a fixed moment, so no database and no clock are involved. The
tests that need the database (FR-22, "not found", a full answer) use the test session.
"""
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from pathlib import Path

import pytest
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import Category, Listing, OpeningHours, PhoneNumber, Service
from app.models.base import ListingStatus
from app.repositories.listing_repository import ListingDetailRows
from app.services import listing_service
from app.services.listing_service import DISCLAIMER, ListingNotFoundError, get_published_listing, to_detail
from app.services.search_service import REPORT_WINDOW
from tests.factories import add_listing, add_report

TUESDAY_10_00_IN_LAGOS = datetime(2026, 10, 6, 9, 0, tzinfo=timezone.utc)  # Lagos is UTC+1
TUESDAY = 1  # 0 = Monday


def make_rows(
    *,
    phones: list[PhoneNumber] | None = None,
    hours: list[OpeningHours] | None = None,
    services: list[Service] | None = None,
    **listing_fields: object,
) -> ListingDetailRows:
    fields: dict[str, object] = {
        "id": 7, "slug": "night-pharmacy-a", "name": "Night Pharmacy A", "category_id": 1,
        "area": "New Haven", "address": "12 Example Road", "landmark": "Opposite the market",
        "latitude": 6.452, "longitude": 7.51,
        "description": "Open late every day.", "status": ListingStatus.published,
        "entrance_photo_url": "https://example.test/photo.jpg",
    }
    fields.update(listing_fields)
    return ListingDetailRows(
        listing=Listing(**fields),
        category=Category(id=1, name="Pharmacy", slug="pharmacy", is_emergency=False, recheck_days=45),
        phones=phones or [],
        opening_hours=hours or [],
        services=services or [],
    )


def hours_row(day: int, opens_at: time | None, closes_at: time | None, *, is_closed: bool = False,
              row_id: int | None = None) -> OpeningHours:
    return OpeningHours(
        id=row_id, listing_id=7, day_of_week=day, opens_at=opens_at, closes_at=closes_at, is_closed=is_closed
    )


def phone(row_id: int, number: str, *, is_primary: bool = False, is_whatsapp: bool = False,
          label: str | None = None) -> PhoneNumber:
    return PhoneNumber(
        id=row_id, listing_id=7, number=number, label=label, is_primary=is_primary, is_whatsapp=is_whatsapp
    )


def detail(rows: ListingDetailRows, *, reported: bool = False, moment: datetime = TUESDAY_10_00_IN_LAGOS):
    return to_detail(rows, recently_reported=reported, moment=moment)


# --- the 7 opening-hours entries ---

def test_opening_hours_has_7_entries_monday_first_whatever_rows_exist() -> None:
    rows = make_rows(hours=[hours_row(2, time(8, 0), time(17, 0)), hours_row(0, time(9, 0), time(18, 0))])

    answer = detail(rows)

    assert [entry.day_of_week for entry in answer.opening_hours] == [0, 1, 2, 3, 4, 5, 6]
    assert len(detail(make_rows()).opening_hours) == 7  # even with no rows at all


def test_a_day_with_no_row_a_closed_day_and_a_row_without_times_are_closed_with_null_times() -> None:
    rows = make_rows(
        hours=[
            hours_row(0, time(8, 0), time(17, 0), is_closed=True),  # marked closed, times still stored
            hours_row(1, None, None),  # not marked closed, but no times
            hours_row(3, time(8, 0), time(17, 0)),  # an open day, for comparison
            hours_row(4, time(9, 0), time(9, 0)),  # opens and closes at the same time: never open
        ]
    )

    entries = {entry.day_of_week: entry for entry in detail(rows).opening_hours}

    for day in (0, 1, 2, 4, 5, 6):  # day 2 has no row at all
        entry = entries[day]
        assert (entry.is_closed, entry.opens_at, entry.closes_at) == (True, None, None), day
    assert (entries[3].is_closed, entries[3].opens_at, entries[3].closes_at) == (False, "08:00", "17:00")


def test_a_past_midnight_row_keeps_its_opening_and_closing_times() -> None:
    rows = make_rows(hours=[hours_row(0, time(20, 0), time(2, 0))])

    monday = detail(rows).opening_hours[0]

    assert (monday.opens_at, monday.closes_at, monday.is_closed) == ("20:00", "02:00", False)


def test_times_are_hh_mm_text_without_seconds() -> None:
    rows = make_rows(hours=[hours_row(0, time(8, 5, 30), time(17, 45, 59))])

    monday = detail(rows).opening_hours[0]

    assert (monday.opens_at, monday.closes_at) == ("08:05", "17:45")


def test_with_two_rows_for_one_day_the_one_with_the_lowest_id_is_used() -> None:
    rows = make_rows(
        hours=[
            hours_row(0, time(10, 0), time(12, 0), row_id=9),
            hours_row(0, time(8, 0), time(17, 0), row_id=4),
        ]
    )

    monday = detail(rows).opening_hours[0]

    assert (monday.opens_at, monday.closes_at) == ("08:00", "17:00")


# --- phones ---

def test_the_primary_phone_is_first_the_others_follow_by_id_and_primary_phone_is_its_number() -> None:
    rows = make_rows(
        phones=[
            phone(1, "+2340000000001"),
            phone(3, "+2340000000003"),
            phone(2, "+2340000000002", is_primary=True, label="Front desk"),
        ]
    )

    answer = detail(rows)

    assert [item.number for item in answer.phones] == ["+2340000000002", "+2340000000001", "+2340000000003"]
    assert answer.phones[0].label == "Front desk"
    assert answer.primary_phone == "+2340000000002"


def test_with_two_primary_phones_the_first_by_id_is_the_primary_one() -> None:
    rows = make_rows(
        phones=[phone(5, "+2340000000005", is_primary=True), phone(2, "+2340000000002", is_primary=True)]
    )

    answer = detail(rows)

    assert answer.primary_phone == "+2340000000002"
    assert [item.number for item in answer.phones] == ["+2340000000002", "+2340000000005"]


def test_a_listing_with_no_primary_phone_has_primary_phone_null_and_its_numbers_in_order_of_id() -> None:
    rows = make_rows(phones=[phone(4, "+2340000000004"), phone(2, "+2340000000002")])

    answer = detail(rows)

    assert answer.primary_phone is None
    assert [item.number for item in answer.phones] == ["+2340000000002", "+2340000000004"]


def test_a_listing_with_no_phone_has_an_empty_list() -> None:
    answer = detail(make_rows())

    assert answer.phones == []
    assert answer.primary_phone is None


def test_each_phone_carries_its_is_whatsapp_value_false_unless_it_was_set() -> None:
    rows = make_rows(
        phones=[
            phone(1, "+2340000000001", is_primary=True),
            phone(2, "+2340000000002", is_whatsapp=True),
        ]
    )

    answer = detail(rows)

    assert [(item.number, item.is_whatsapp) for item in answer.phones] == [
        ("+2340000000001", False),
        ("+2340000000002", True),
    ]


# --- services and fees ---

def test_services_are_sorted_by_name_ignoring_case_then_id() -> None:
    rows = make_rows(
        services=[
            Service(id=3, listing_id=7, name="x-ray"),
            Service(id=2, listing_id=7, name="Consultation"),
            Service(id=5, listing_id=7, name="Malaria test"),
            Service(id=4, listing_id=7, name="malaria test"),
        ]
    )

    answer = detail(rows)

    # "malaria test" (id 4) comes before "Malaria test" (id 5): the same name without case, so the id decides.
    names = [item.name for item in answer.services]
    assert names == ["Consultation", "malaria test", "Malaria test", "x-ray"]


def test_fees_are_strings_with_2_decimals_a_missing_fee_stays_null_and_the_date_is_iso() -> None:
    rows = make_rows(
        services=[
            Service(
                id=1, listing_id=7, name="Malaria test", fee_min_naira=Decimal("1500"),
                fee_max_naira=Decimal("3000.5"), fee_collected_at=date(2026, 9, 28),
            ),
            Service(id=2, listing_id=7, name="Consultation", fee_min_naira=Decimal("2000.00")),
            Service(id=3, listing_id=7, name="Dressing"),
        ]
    )

    services = detail(rows).model_dump(mode="json")["services"]
    by_name = {item["name"]: item for item in services}

    assert by_name["Malaria test"] == {
        "name": "Malaria test", "fee_min_naira": "1500.00", "fee_max_naira": "3000.50",
        "fee_collected_at": "2026-09-28",
    }
    # Only a minimum: the maximum is not made up from it. No fee at all: both null, and so is the date.
    assert by_name["Consultation"]["fee_min_naira"] == "2000.00"
    assert by_name["Consultation"]["fee_max_naira"] is None
    assert by_name["Consultation"]["fee_collected_at"] is None
    assert by_name["Dressing"] == {
        "name": "Dressing", "fee_min_naira": None, "fee_max_naira": None, "fee_collected_at": None,
    }


# --- the rest of the answer ---

def test_the_disclaimer_is_the_fixed_text() -> None:
    # The app became SwiftHealth Route on 2026-10-13: the name shows on every listing page.
    assert detail(make_rows()).disclaimer == (
        "SwiftHealth Route is a directory and does not give medical advice. "
        "Fees are estimates; confirm with the facility."
    )
    assert DISCLAIMER == detail(make_rows()).disclaimer


def test_the_listing_and_category_fields_are_carried_into_the_answer() -> None:
    answer = detail(make_rows(last_verified_at=TUESDAY_10_00_IN_LAGOS - timedelta(days=3)))

    assert (answer.id, answer.slug, answer.name) == (7, "night-pharmacy-a", "Night Pharmacy A")
    assert (answer.category.slug, answer.category.name) == ("pharmacy", "Pharmacy")
    assert (answer.area, answer.address) == ("New Haven", "12 Example Road")
    assert answer.landmark == "Opposite the market"
    assert (answer.latitude, answer.longitude) == (6.452, 7.51)
    assert answer.description == "Open late every day."
    assert answer.entrance_photo_url == "https://example.test/photo.jpg"
    assert answer.last_verified_at == TUESDAY_10_00_IN_LAGOS - timedelta(days=3)


def test_verification_due_is_true_after_next_check_due_and_false_before_it_or_with_no_date() -> None:
    moment = TUESDAY_10_00_IN_LAGOS

    assert detail(make_rows(next_check_due=moment - timedelta(seconds=1))).verification_due is True
    assert detail(make_rows(next_check_due=moment + timedelta(days=1))).verification_due is False
    assert detail(make_rows(next_check_due=None)).verification_due is False


def test_recently_reported_not_working_is_the_flag_that_was_given() -> None:
    assert detail(make_rows(), reported=True).recently_reported_not_working is True
    assert detail(make_rows(), reported=False).recently_reported_not_working is False


def test_distance_is_null_and_sponsored_is_false() -> None:
    answer = detail(make_rows())

    assert answer.distance_km is None
    assert answer.sponsored is False


def test_is_open_now_and_hours_note_come_from_the_moment_given_in_lagos_time() -> None:
    hours = [hours_row(day, time(20, 0), time(2, 0)) for day in range(7)]
    rows = make_rows(hours=hours)

    morning = detail(rows, moment=TUESDAY_10_00_IN_LAGOS)
    evening = detail(rows, moment=datetime(2026, 10, 6, 20, 0, tzinfo=timezone.utc))  # 21:00 in Lagos

    assert (morning.is_open_now, morning.hours_note) == (False, "Opens 8:00 PM")
    assert (evening.is_open_now, evening.hours_note) == (True, "Closes 2:00 AM tomorrow")


def test_a_24_hour_listing_is_open_now_and_has_no_hours_note() -> None:
    answer = detail(make_rows(is_24_hours=True, hours=[hours_row(1, time(8, 0), time(9, 0))]))

    assert (answer.is_24_hours, answer.is_open_now, answer.hours_note) == (True, True, None)


def test_the_service_raises_no_http_error() -> None:
    source = Path(listing_service.__file__).read_text()

    assert "HTTPException" not in source
    assert "fastapi" not in source


# --- with the database ---

@pytest.mark.anyio
async def test_recently_reported_follows_the_reports_in_the_database(session: AsyncSession) -> None:
    listing = await add_listing(session, "Night Pharmacy A")
    moment = TUESDAY_10_00_IN_LAGOS
    await add_report(session, listing, "reporter-1", created_at=moment - timedelta(days=1))

    one_reporter = await get_published_listing(session, "night-pharmacy-a", moment)
    await add_report(session, listing, "reporter-2", created_at=moment - timedelta(hours=1))
    two_reporters = await get_published_listing(session, "night-pharmacy-a", moment)
    later = moment + REPORT_WINDOW + timedelta(days=2)
    long_after = await get_published_listing(session, "night-pharmacy-a", later)

    assert one_reporter.recently_reported_not_working is False
    assert two_reporters.recently_reported_not_working is True  # still returned: only the flag changes
    assert long_after.recently_reported_not_working is False  # the reports are now older than 7 days


@pytest.mark.anyio
async def test_a_missing_or_unpublished_listing_raises_listing_not_found_error(session: AsyncSession) -> None:
    await add_listing(session, "Hidden Place", status=ListingStatus.hidden)

    with pytest.raises(ListingNotFoundError):
        await get_published_listing(session, "no-such-slug", TUESDAY_10_00_IN_LAGOS)
    with pytest.raises(ListingNotFoundError):
        await get_published_listing(session, "hidden-place", TUESDAY_10_00_IN_LAGOS)


@pytest.mark.anyio
async def test_a_published_listing_from_the_database_gives_the_full_answer(session: AsyncSession) -> None:
    await add_listing(
        session,
        "Night Pharmacy A",
        phones=[
            PhoneNumber(listing_id=0, number="+2340000000001", is_primary=True),
            PhoneNumber(listing_id=0, number="+2340000000002", is_whatsapp=True),
        ],
        opening_hours=[hours_row(day, time(8, 0), time(17, 0)) for day in range(7)],
        services=[Service(listing_id=0, name="Dispensing", fee_min_naira=Decimal("500.00"))],
    )

    answer = await get_published_listing(session, "night-pharmacy-a", TUESDAY_10_00_IN_LAGOS)

    assert answer.primary_phone == "+2340000000001"
    assert [item.is_whatsapp for item in answer.phones] == [False, True]
    assert answer.opening_hours[TUESDAY].opens_at == "08:00"
    assert answer.is_open_now is True
    assert answer.services[0].fee_min_naira == Decimal("500.00")
