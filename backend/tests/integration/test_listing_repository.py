"""The SQL side of the listing detail: one published listing with everything that belongs to it, and FR-22.
Requirements: FR-09, FR-10, FR-47, US-06, US-07, FR-22, NFR-07, NFR-08.

Decisions 3, 7 and 9 in specs/2026-10-11-listing-detail-api/requirements.md. The report check uses the same
query and the same constants as the search exclusion, so a listing that search hides is a listing that the
detail flags.
"""
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy import event
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import PhoneNumber, Service
from app.models.base import ListingStatus, ReportReason, ReportStatus
from app.repositories import listing_repository
from app.services.search_service import REPORT_WINDOW, REPORTS_TO_EXCLUDE
from tests.factories import add_listing, add_report, every_day

pytestmark = pytest.mark.anyio

NOW = datetime(2026, 10, 6, 9, 0, tzinfo=timezone.utc)
REPORTS_SINCE = NOW - REPORT_WINDOW


async def is_reported(session: AsyncSession, listing_id: int) -> bool:
    return await listing_repository.is_reported_not_working(
        session, listing_id, reports_since=REPORTS_SINCE, reports_to_flag=REPORTS_TO_EXCLUDE
    )


# --- loading one published listing ---

async def test_a_published_listing_is_loaded_with_its_category_phones_hours_and_services(
    session: AsyncSession,
) -> None:
    await add_listing(
        session,
        "Night Pharmacy A",
        category_slug="pharmacy",
        phones=[
            PhoneNumber(listing_id=0, number="+2340000000001", label="Front desk", is_primary=True),
            PhoneNumber(listing_id=0, number="+2340000000002", is_whatsapp=True),
        ],
        opening_hours=every_day(time(20, 0), time(2, 0)),
        services=[
            Service(
                listing_id=0, name="Malaria test", fee_min_naira=Decimal("1500.00"),
                fee_max_naira=Decimal("3000.00"), fee_collected_at=date(2026, 9, 28),
            )
        ],
    )

    rows = await listing_repository.get_published_detail_by_slug(session, "night-pharmacy-a")

    assert rows is not None
    assert (rows.listing.name, rows.listing.slug) == ("Night Pharmacy A", "night-pharmacy-a")
    assert (rows.category.slug, rows.category.name) == ("pharmacy", "Pharmacy")
    assert [(phone.number, phone.label, phone.is_primary, phone.is_whatsapp) for phone in rows.phones] == [
        ("+2340000000001", "Front desk", True, False),
        ("+2340000000002", None, False, True),
    ]
    assert len(rows.opening_hours) == 7
    assert [service.name for service in rows.services] == ["Malaria test"]
    assert rows.services[0].fee_min_naira == Decimal("1500.00")


async def test_the_phones_come_back_in_the_order_they_were_added_and_the_hours_by_day(
    session: AsyncSession,
) -> None:
    hours = list(reversed(every_day(time(8, 0), time(17, 0))))  # added Sunday first: the query must sort them
    await add_listing(
        session,
        "Night Pharmacy A",
        phones=[PhoneNumber(listing_id=0, number=f"+234000000010{index}") for index in range(3)],
        opening_hours=hours,
    )

    rows = await listing_repository.get_published_detail_by_slug(session, "night-pharmacy-a")

    assert rows is not None
    assert [phone.number for phone in rows.phones] == ["+2340000000100", "+2340000000101", "+2340000000102"]
    assert [row.day_of_week for row in rows.opening_hours] == [0, 1, 2, 3, 4, 5, 6]


async def test_a_listing_with_no_phones_no_hours_and_no_services_is_loaded_with_empty_lists(
    session: AsyncSession,
) -> None:
    await add_listing(session, "Night Pharmacy A", phone=None)

    rows = await listing_repository.get_published_detail_by_slug(session, "night-pharmacy-a")

    assert rows is not None
    assert (rows.phones, rows.opening_hours, rows.services) == ([], [], [])


async def test_the_details_of_another_listing_are_not_mixed_in(session: AsyncSession) -> None:
    await add_listing(session, "Night Pharmacy A", phone="+2340000000001", service_names=("Dispensing",))
    await add_listing(session, "Night Pharmacy B", phone="+2340000000002", service_names=("Malaria test",))

    rows = await listing_repository.get_published_detail_by_slug(session, "night-pharmacy-b")

    assert rows is not None
    assert [phone.number for phone in rows.phones] == ["+2340000000002"]
    assert [service.name for service in rows.services] == ["Malaria test"]


@pytest.mark.parametrize(
    "status",
    [ListingStatus.draft, ListingStatus.pending_review, ListingStatus.hidden, ListingStatus.recheck_due],
)
async def test_a_listing_that_is_not_published_is_not_found(
    session: AsyncSession, status: ListingStatus
) -> None:
    await add_listing(session, "Night Pharmacy A", status=status)

    assert await listing_repository.get_published_detail_by_slug(session, "night-pharmacy-a") is None


async def test_an_unknown_slug_is_not_found(session: AsyncSession) -> None:
    await add_listing(session, "Night Pharmacy A")

    assert await listing_repository.get_published_detail_by_slug(session, "night-pharmacy-z") is None


@pytest.mark.parametrize(
    "slug", ["Night-Pharmacy-A", "night-pharmacy-a ", " night-pharmacy-a", "night-pharmacy", ""]
)
async def test_the_slug_must_match_exactly(session: AsyncSession, slug: str) -> None:
    await add_listing(session, "Night Pharmacy A")

    assert await listing_repository.get_published_detail_by_slug(session, slug) is None


async def count_statements(session: AsyncSession, slug: str) -> int:
    """How many SQL statements loading this listing sends to the database."""
    statements: list[str] = []

    def record(connection, cursor, statement, parameters, context, executemany) -> None:  # noqa: ANN001
        statements.append(statement)

    engine = session.bind.sync_engine  # type: ignore[union-attr]
    event.listen(engine, "before_cursor_execute", record)
    try:
        assert await listing_repository.get_published_detail_by_slug(session, slug) is not None
    finally:
        event.remove(engine, "before_cursor_execute", record)
    return len(statements)


async def test_the_number_of_queries_is_the_same_for_one_phone_and_ten(session: AsyncSession) -> None:
    await add_listing(
        session,
        "Small Pharmacy",
        phones=[PhoneNumber(listing_id=0, number="+2340000000001", is_primary=True)],
        service_names=("Dispensing",),
    )
    await add_listing(
        session,
        "Big Pharmacy",
        phones=[PhoneNumber(listing_id=0, number=f"+234000000020{index}") for index in range(10)],
        service_names=tuple(f"Service {index}" for index in range(10)),
        opening_hours=every_day(time(8, 0), time(17, 0)),
    )
    session.expire_all()

    small = await count_statements(session, "small-pharmacy")
    big = await count_statements(session, "big-pharmacy")

    assert small == big
    assert small <= 4  # the listing with its category, then the phones, the hours and the services


# --- the report check (FR-22) ---

async def test_two_different_reporters_in_the_last_7_days_report_the_listing(session: AsyncSession) -> None:
    listing = await add_listing(session, "Night Pharmacy A")
    await add_report(session, listing, "reporter-1", created_at=NOW - timedelta(days=1))
    await add_report(session, listing, "reporter-2", created_at=NOW - timedelta(hours=2))

    assert await is_reported(session, listing.id) is True


async def test_one_reporter_does_not_report_the_listing(session: AsyncSession) -> None:
    listing = await add_listing(session, "Night Pharmacy A")
    await add_report(session, listing, "reporter-1", created_at=NOW - timedelta(days=1))

    assert await is_reported(session, listing.id) is False


async def test_two_reports_from_the_same_reporter_do_not_report_the_listing(session: AsyncSession) -> None:
    listing = await add_listing(session, "Night Pharmacy A")
    await add_report(session, listing, "reporter-1", created_at=NOW - timedelta(days=1))
    await add_report(session, listing, "reporter-1", created_at=NOW - timedelta(hours=1))

    assert await is_reported(session, listing.id) is False


async def test_a_report_older_than_the_window_does_not_count(session: AsyncSession) -> None:
    listing = await add_listing(session, "Night Pharmacy A")
    await add_report(session, listing, "reporter-1", created_at=NOW - timedelta(days=1))
    await add_report(session, listing, "reporter-2", created_at=REPORTS_SINCE - timedelta(seconds=1))

    assert await is_reported(session, listing.id) is False


async def test_a_report_exactly_at_the_start_of_the_window_counts(session: AsyncSession) -> None:
    listing = await add_listing(session, "Night Pharmacy A")
    await add_report(session, listing, "reporter-1", created_at=NOW - timedelta(days=1))
    await add_report(session, listing, "reporter-2", created_at=REPORTS_SINCE)

    assert await is_reported(session, listing.id) is True


async def test_a_resolved_report_does_not_count(session: AsyncSession) -> None:
    listing = await add_listing(session, "Night Pharmacy A")
    await add_report(session, listing, "reporter-1", created_at=NOW - timedelta(days=1))
    await add_report(
        session, listing, "reporter-2", created_at=NOW - timedelta(days=1), status=ReportStatus.resolved
    )

    assert await is_reported(session, listing.id) is False


async def test_a_report_with_another_reason_does_not_count(session: AsyncSession) -> None:
    listing = await add_listing(session, "Night Pharmacy A")
    await add_report(session, listing, "reporter-1", created_at=NOW - timedelta(days=1))
    await add_report(
        session, listing, "reporter-2", created_at=NOW - timedelta(days=1), reason=ReportReason.wrong_number
    )

    assert await is_reported(session, listing.id) is False


async def test_a_report_with_no_reporter_key_does_not_count(session: AsyncSession) -> None:
    listing = await add_listing(session, "Night Pharmacy A")
    await add_report(session, listing, "reporter-1", created_at=NOW - timedelta(days=1))
    await add_report(session, listing, None, created_at=NOW - timedelta(days=1))

    assert await is_reported(session, listing.id) is False


async def test_the_reports_of_another_listing_do_not_count(session: AsyncSession) -> None:
    listing = await add_listing(session, "Night Pharmacy A")
    other = await add_listing(session, "Night Pharmacy B")
    await add_report(session, other, "reporter-1", created_at=NOW - timedelta(days=1))
    await add_report(session, other, "reporter-2", created_at=NOW - timedelta(days=1))

    assert await is_reported(session, listing.id) is False
    assert await is_reported(session, other.id) is True


async def test_the_detail_and_search_use_the_same_rule(session: AsyncSession) -> None:
    from app.repositories.search_repository import flagged_listing_ids

    listing = await add_listing(session, "Night Pharmacy A")
    await add_report(session, listing, "reporter-1", created_at=NOW - timedelta(days=1))
    await add_report(session, listing, "reporter-2", created_at=NOW - timedelta(days=1))

    flagged_by_search = (await session.exec(flagged_listing_ids(REPORTS_SINCE, REPORTS_TO_EXCLUDE))).all()

    assert listing.id in flagged_by_search
    assert await is_reported(session, listing.id) is True
