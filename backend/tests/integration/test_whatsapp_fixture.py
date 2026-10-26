"""The local WhatsApp test fixture in the database, and through GET /listings/{slug}.
Requirements: FR-47, FR-22, FR-09, US-06, NFR-07. Spec: specs/2026-10-13-listing-page/requirements.md D11.
Runs on the PostgreSQL test database.
"""
from datetime import timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import func
from sqlmodel import SQLModel, col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import AuditEntry, Category, Listing, OpeningHours, PhoneNumber, Service, User, UserReport
from app.models.base import ListingStatus, utcnow
from seed.demo_listings import seed_demo_listings
from seed.whatsapp_fixture import FIXTURE_NAME, FIXTURE_SLUG, main, seed_whatsapp_fixture

pytestmark = pytest.mark.anyio

ALL_TABLES = (Listing, PhoneNumber, OpeningHours, Service, UserReport, AuditEntry, Category, User)


async def table_counts(session: AsyncSession) -> dict[str, int]:
    counts: dict[str, int] = {}
    for model in ALL_TABLES:
        table: type[SQLModel] = model
        counts[table.__tablename__] = (await session.exec(select(func.count()).select_from(table))).one()
    return counts


async def test_it_adds_exactly_one_listing_with_its_rows_and_nothing_else(session: AsyncSession) -> None:
    before = await table_counts(session)

    created = await seed_whatsapp_fixture(session, utcnow())

    after = await table_counts(session)
    changes = {name: after[name] - before[name] for name in after}
    assert created == {"listings": 1}
    # The clinic category is reference data: a database that has it gets no new row, one that lacks it (the
    # test database) gets just that one, exactly as the demo listings do.
    assert changes.pop("categories") in (0, 1)
    assert changes == {
        "listings": 1,
        "phone_numbers": 3,
        "opening_hours": 7,
        "services": 4,
        "user_reports": 2,
        "audit_entries": 1,  # every listing change writes an audit entry
        "users": 0,
    }


async def test_running_it_twice_changes_nothing_the_second_time(session: AsyncSession) -> None:
    await seed_whatsapp_fixture(session, utcnow())
    after_first = await table_counts(session)

    created = await seed_whatsapp_fixture(session, utcnow())

    assert created == {"listings": 0}
    assert await table_counts(session) == after_first


async def test_running_it_again_later_renews_the_two_reports_so_the_recently_reported_note_still_shows(
    session: AsyncSession,
) -> None:
    """The note needs two reporters in the last 7 days (FR-22), so a fixture made weeks ago
    stopped showing it and the real-browser check of the listing page failed. Running the
    command again now renews the dates of its two reports."""
    first_day = utcnow()
    await seed_whatsapp_fixture(session, first_day)
    after_first = await table_counts(session)
    three_weeks_later = first_day + timedelta(days=21)

    created = await seed_whatsapp_fixture(session, three_weeks_later)

    assert created == {"listings": 0}
    assert await table_counts(session) == after_first  # nothing added
    reports = (await session.exec(select(UserReport))).all()
    assert len(reports) == 2
    for report in reports:
        assert three_weeks_later - timedelta(days=2) <= report.created_at <= three_weeks_later


async def test_the_listing_page_api_shows_what_the_owner_needs_to_look_at(
    session: AsyncSession, client: AsyncClient
) -> None:
    await seed_whatsapp_fixture(session, utcnow())

    response = await client.get(f"/listings/{FIXTURE_SLUG}")

    assert response.status_code == 200
    page = response.json()
    assert page["name"] == FIXTURE_NAME
    assert page["description"].startswith("Fictional test fixture")
    flags = [(phone["is_primary"], phone["is_whatsapp"]) for phone in page["phones"]]
    assert flags == [(True, True), (False, False), (False, True)]
    assert page["phones"][0]["number"] == page["primary_phone"]  # the primary number first
    assert page["recently_reported_not_working"] is True  # two different reporters, in the last 7 days
    assert page["entrance_photo_url"].startswith("https://")
    assert len(page["opening_hours"]) == 7
    assert any(day["is_closed"] for day in page["opening_hours"])
    open_days = [day for day in page["opening_hours"] if not day["is_closed"]]
    assert any(day["closes_at"] < day["opens_at"] for day in open_days)  # past midnight
    fees = {
        service["name"]: (service["fee_min_naira"], service["fee_max_naira"], service["fee_collected_at"])
        for service in page["services"]
    }
    assert fees["Consultation"][:2] == ("1500.00", "3000.00")
    assert fees["Consultation"][2] is not None  # a range with a date
    assert fees["Blood pressure check"] == ("500.00", "500.00", None)
    assert fees["Malaria test"] == ("1000.00", None, None)
    assert fees["Home visit"] == (None, None, None)
    assert page["is_24_hours"] is False


async def test_the_demo_listings_still_mark_no_number_as_whatsapp(session: AsyncSession) -> None:
    await seed_demo_listings(session, utcnow())  # the production demo listings, as before
    marked = col(PhoneNumber.is_whatsapp).is_(True)
    count = (await session.exec(select(func.count()).select_from(PhoneNumber).where(marked))).one()

    assert count == 0


async def test_the_fixture_listing_is_published_so_the_page_can_show_it(session: AsyncSession) -> None:
    await seed_whatsapp_fixture(session, utcnow())

    listing = (await session.exec(select(Listing).where(Listing.slug == FIXTURE_SLUG))).one()
    assert listing.status == ListingStatus.published


async def test_it_refuses_to_run_in_production_and_touches_nothing(session: AsyncSession) -> None:
    before = await table_counts(session)

    exit_code = await main({"APP_ENV": "production"})

    assert exit_code == 1
    assert await table_counts(session) == before
