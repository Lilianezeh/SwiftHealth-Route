"""GET /listings/{slug} through HTTP.
Requirements: FR-09, FR-10, FR-11, FR-13, FR-47, US-06, US-07, FR-08, FR-22, NFR-07.

The contract is specs/backend/api-spec.md, "GET /listings/{slug}" and "ListingDetail". The clock is replaced
with a fixed moment, so the open-now and overdue tests do not depend on the time the suite runs. Decisions in
specs/2026-10-11-listing-detail-api/requirements.md.
"""
from collections.abc import Iterator
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment
from app.main import app
from app.models import AuditEntry, PhoneNumber, Service
from app.models.base import ListingStatus
from tests.factories import add_listing, add_report, every_day

pytestmark = pytest.mark.anyio

TUESDAY_10_00_IN_LAGOS = datetime(2026, 10, 6, 9, 0, tzinfo=timezone.utc)  # Lagos is UTC+1

DETAIL_FIELDS = {
    # ListingSummary
    "id", "slug", "name", "category", "area", "address", "latitude", "longitude", "distance_km",
    "is_open_now", "is_24_hours", "primary_phone", "last_verified_at", "verification_due", "sponsored",
    "hours_note", "branch_of",
    # ListingDetail
    "landmark", "description", "entrance_photo_url", "phones", "opening_hours", "services",
    "recently_reported_not_working", "disclaimer", "branches",
}
INTERNAL_WORDS = (
    "parent_id", "closed_at", "closed_reason", "status", "next_check_due", "owner_id", "created_by",
    "featured_until", "reporter_key", "reporter_phone",
    "created_at", "updated_at", "category_id",
)


@pytest.fixture
def clock() -> Iterator[list[datetime]]:
    """Fixes the moment the route sees. A test changes it with `clock[0] = ...`. Removed after the test."""
    moment = [TUESDAY_10_00_IN_LAGOS]
    app.dependency_overrides[get_current_moment] = lambda: moment[0]
    yield moment
    app.dependency_overrides.pop(get_current_moment, None)


async def get_listing(client: AsyncClient, slug: str, expected_status: int = 200) -> dict:
    response = await client.get(f"/listings/{slug}")
    assert response.status_code == expected_status, response.text
    return response.json()


async def test_a_published_listing_returns_200_with_exactly_the_fields_of_listing_detail(
    client: AsyncClient, session: AsyncSession, clock: list[datetime]
) -> None:
    await add_listing(session, "Night Pharmacy A", opening_hours=every_day(time(8, 0), time(17, 0)))

    body = await get_listing(client, "night-pharmacy-a")

    assert set(body) == DETAIL_FIELDS
    assert body["slug"] == "night-pharmacy-a"
    assert body["category"] == {"slug": "pharmacy", "name": "Pharmacy"}
    assert body["distance_km"] is None
    assert body["sponsored"] is False


async def test_the_listing_page_needs_no_token(
    client: AsyncClient, session: AsyncSession, clock: list[datetime]
) -> None:
    await add_listing(session, "Night Pharmacy A")

    response = await client.get("/listings/night-pharmacy-a")  # no Authorization header

    assert response.status_code == 200


@pytest.mark.parametrize(
    "status",
    [ListingStatus.draft, ListingStatus.pending_review, ListingStatus.hidden, ListingStatus.recheck_due],
)
async def test_a_listing_that_is_not_published_is_a_404_with_the_same_body_as_an_unknown_slug(
    client: AsyncClient, session: AsyncSession, clock: list[datetime], status: ListingStatus
) -> None:
    await add_listing(session, "Night Pharmacy A", status=status)

    not_published = await get_listing(client, "night-pharmacy-a", expected_status=404)
    unknown = await get_listing(client, "no-such-listing", expected_status=404)

    assert not_published == unknown == {"detail": "Listing not found"}


async def test_an_odd_slug_is_just_a_404(
    client: AsyncClient, session: AsyncSession, clock: list[datetime]
) -> None:
    await add_listing(session, "Night Pharmacy A")

    assert (await get_listing(client, "id", expected_status=404)) == {"detail": "Listing not found"}
    assert (await client.get("/listings/abc/def")).status_code == 404  # a slash makes it another path
    assert (await client.get("/listings/Night-Pharmacy-A")).status_code == 404  # the slug matches exactly


async def test_the_phones_the_seven_opening_hours_entries_and_the_services_are_in_the_answer(
    client: AsyncClient, session: AsyncSession, clock: list[datetime]
) -> None:
    await add_listing(
        session,
        "Night Pharmacy A",
        phones=[
            PhoneNumber(listing_id=0, number="+2340000000001", label="Back office"),
            PhoneNumber(listing_id=0, number="+2340000000002", label="Front desk", is_primary=True),
        ],
        opening_hours=every_day(time(20, 0), time(2, 0)),
        services=[Service(listing_id=0, name="Dispensing")],
    )

    body = await get_listing(client, "night-pharmacy-a")

    assert [(phone["number"], phone["label"], phone["is_primary"]) for phone in body["phones"]] == [
        ("+2340000000002", "Front desk", True),
        ("+2340000000001", "Back office", False),
    ]
    assert body["primary_phone"] == "+2340000000002"
    assert [entry["day_of_week"] for entry in body["opening_hours"]] == [0, 1, 2, 3, 4, 5, 6]
    assert body["opening_hours"][0] == {
        "day_of_week": 0, "opens_at": "20:00", "closes_at": "02:00", "is_closed": False,
    }
    assert [service["name"] for service in body["services"]] == ["Dispensing"]


async def test_a_whatsapp_number_has_is_whatsapp_true_and_the_others_false(
    client: AsyncClient, session: AsyncSession, clock: list[datetime]
) -> None:
    await add_listing(
        session,
        "Night Pharmacy A",
        phones=[
            PhoneNumber(listing_id=0, number="+2340000000001", is_primary=True),
            PhoneNumber(listing_id=0, number="+2340000000002", is_whatsapp=True),
        ],
    )

    body = await get_listing(client, "night-pharmacy-a")

    assert [(phone["number"], phone["is_whatsapp"]) for phone in body["phones"]] == [
        ("+2340000000001", False),
        ("+2340000000002", True),
    ]


async def test_fees_are_strings_with_two_decimals_in_the_json_and_a_null_fee_stays_null(
    client: AsyncClient, session: AsyncSession, clock: list[datetime]
) -> None:
    await add_listing(
        session,
        "Night Pharmacy A",
        services=[
            Service(
                listing_id=0, name="Malaria test", fee_min_naira=Decimal("1500.00"),
                fee_max_naira=Decimal("3000.00"), fee_collected_at=date(2026, 9, 28),
            ),
            Service(listing_id=0, name="Dressing"),
        ],
    )

    response = await client.get("/listings/night-pharmacy-a")

    services = {service["name"]: service for service in response.json()["services"]}
    assert services["Malaria test"] == {
        "name": "Malaria test", "fee_min_naira": "1500.00", "fee_max_naira": "3000.00",
        "fee_collected_at": "2026-09-28",
    }
    assert services["Dressing"] == {
        "name": "Dressing", "fee_min_naira": None, "fee_max_naira": None, "fee_collected_at": None,
    }
    # A string in the raw JSON, not a number.
    assert '"fee_min_naira":"1500.00"' in response.text.replace(" ", "")


async def test_an_overdue_published_listing_is_returned_with_verification_due_true(
    client: AsyncClient, session: AsyncSession, clock: list[datetime]
) -> None:
    await add_listing(
        session, "Overdue Place", last_verified_at=clock[0] - timedelta(days=60),
        next_check_due=clock[0] - timedelta(days=15),
    )
    await add_listing(session, "Fresh Place", next_check_due=clock[0] + timedelta(days=30))

    assert (await get_listing(client, "overdue-place"))["verification_due"] is True
    assert (await get_listing(client, "fresh-place"))["verification_due"] is False


async def test_a_listing_hidden_from_search_by_two_reporters_is_still_returned_with_the_flag(
    client: AsyncClient, session: AsyncSession, clock: list[datetime]
) -> None:
    reported = await add_listing(session, "Reported Place")
    await add_report(session, reported, "reporter-1", created_at=clock[0] - timedelta(days=1))
    await add_report(session, reported, "reporter-2", created_at=clock[0] - timedelta(hours=3))
    once = await add_listing(session, "Once Reported Place")
    await add_report(session, once, "reporter-1", created_at=clock[0] - timedelta(days=1))

    search_names = [item["name"] for item in (await client.get("/search")).json()["items"]]
    assert "Reported Place" not in search_names  # search hides it (FR-22) ...

    reported_page = await get_listing(client, "reported-place")  # ... the page does not
    assert reported_page["recently_reported_not_working"] is True
    assert (await get_listing(client, "once-reported-place"))["recently_reported_not_working"] is False


async def test_is_open_now_hours_note_and_verification_due_are_the_same_as_in_search(
    client: AsyncClient, session: AsyncSession, clock: list[datetime]
) -> None:
    await add_listing(
        session, "Day Pharmacy", opening_hours=every_day(time(8, 0), time(17, 0)),
        next_check_due=clock[0] - timedelta(days=1),
    )
    await add_listing(session, "Night Pharmacy", opening_hours=every_day(time(20, 0), time(2, 0)))
    await add_listing(session, "Always Open Pharmacy", is_24_hours=True)
    await add_listing(session, "No Hours Pharmacy")

    for moment in (
        TUESDAY_10_00_IN_LAGOS,
        TUESDAY_10_00_IN_LAGOS + timedelta(hours=11),  # 21:00 in Lagos
        TUESDAY_10_00_IN_LAGOS + timedelta(hours=16, minutes=30),  # 02:30 in Lagos, Wednesday
    ):
        clock[0] = moment
        in_search = {item["slug"]: item for item in (await client.get("/search")).json()["items"]}
        assert len(in_search) == 4
        for slug, summary in in_search.items():
            detail = await get_listing(client, slug)
            for field in ("is_open_now", "hours_note", "verification_due", "is_24_hours", "primary_phone"):
                assert detail[field] == summary[field], (slug, field, moment)


async def test_no_internal_field_and_nothing_about_the_reports_is_in_the_answer(
    client: AsyncClient, session: AsyncSession, clock: list[datetime]
) -> None:
    listing = await add_listing(
        session, "Reported Place", featured_until=clock[0] + timedelta(days=10),
        next_check_due=clock[0] + timedelta(days=5),
    )
    await add_report(session, listing, "secret-reporter-key-1", created_at=clock[0] - timedelta(days=1))
    await add_report(session, listing, "secret-reporter-key-2", created_at=clock[0] - timedelta(days=2))

    response = await client.get("/listings/reported-place")

    assert response.status_code == 200
    for word in INTERNAL_WORDS:
        assert f'"{word}"' not in response.text, word
    assert "secret-reporter-key" not in response.text
    assert set(response.json()) == DETAIL_FIELDS


async def test_a_request_writes_no_audit_entry(
    client: AsyncClient, session: AsyncSession, clock: list[datetime]
) -> None:
    await add_listing(session, "Night Pharmacy A")
    count_before = (await session.exec(select(func.count()).select_from(AuditEntry))).one()

    await get_listing(client, "night-pharmacy-a")
    await get_listing(client, "no-such-listing", expected_status=404)

    assert (await session.exec(select(func.count()).select_from(AuditEntry))).one() == count_before


async def test_docs_lists_the_endpoint_under_the_listings_tag(client: AsyncClient) -> None:
    response = await client.get("/openapi.json")

    operation = response.json()["paths"]["/listings/{slug}"]["get"]
    assert operation["tags"] == ["Listings"]
    detail_schema = response.json()["components"]["schemas"]["ListingDetail"]
    assert {"phones", "opening_hours", "services", "recently_reported_not_working", "disclaimer"} <= set(
        detail_schema["properties"]
    )
