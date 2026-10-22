"""GET /emergency through HTTP. Requirements: FR-14 to FR-19, FR-25, FR-26, US-04, NFR-07.

The contract is specs/backend/api-spec.md, "GET /emergency". The clock is replaced with a fixed moment.
Decisions A1 to A4 in specs/2026-10-17-swiftrescue/requirements.md.
"""
from collections.abc import Iterator
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment
from app.main import app
from app.models.base import ListingStatus
from tests.factories import add_listing, add_report

pytestmark = pytest.mark.anyio

TUESDAY_10_00_IN_LAGOS = datetime(2026, 10, 6, 9, 0, tzinfo=timezone.utc)
MY_LATITUDE, MY_LONGITUDE = 6.4500, 7.5080
GROUP_SLUGS = [
    "ambulance", "fire", "police", "emergency-unit", "roadside-assistance", "security",
    "disaster-flooding", "gbv-support", "mental-health-crisis",
]
# No blood-bank group since 2026-10-22: blood banks are listed only by /blood (decision M1).
# The last three groups: specs/2026-10-22-swiftrescue-groups/.
GROUP_HEADINGS = [
    "Ambulance", "Fire service", "Police", "Hospital emergency (24 hours)", "Road accidents", "Security",
    "Disaster and flooding", "Sexual and gender-based violence support", "Mental health crisis support",
]
DISCLAIMER = (
    "SwiftRescue connects you to emergency contacts; it does not dispatch or guarantee an emergency "
    "response. In danger, call 112."
)


@pytest.fixture
def clock() -> Iterator[None]:
    app.dependency_overrides[get_current_moment] = lambda: TUESDAY_10_00_IN_LAGOS
    yield
    app.dependency_overrides.pop(get_current_moment, None)


async def get_emergency(client: AsyncClient, **params: object) -> dict:
    response = await client.get("/emergency", params=params)
    assert response.status_code == 200, response.text
    return response.json()


def group(body: dict, slug: str) -> dict:
    return next(entry for entry in body["groups"] if entry["category"]["slug"] == slug)


def contact_names(body: dict, slug: str) -> list[str]:
    return [contact["name"] for contact in group(body, slug)["contacts"]]


async def test_emergency_needs_no_login_and_112_is_there_with_an_empty_database(
    client: AsyncClient, clock: None
) -> None:
    response = await client.get("/emergency")  # no Authorization header
    assert response.status_code == 200
    body = response.json()
    assert body["national_line"] == {"name": "National emergency number", "number": "112"}  # FR-14
    assert set(body) == {"national_line", "groups", "disclaimer"}  # no pharmacy list since 2026-10-22 (K6)
    assert body["disclaimer"] == DISCLAIMER  # FR-26


async def test_all_nine_groups_are_returned_in_the_fixed_order_with_the_new_headings_even_when_empty(
    client: AsyncClient, clock: None
) -> None:
    body = await get_emergency(client)
    assert [entry["category"]["slug"] for entry in body["groups"]] == GROUP_SLUGS  # FR-15, decision A1
    assert [entry["category"]["name"] for entry in body["groups"]] == GROUP_HEADINGS
    assert all(entry["contacts"] == [] for entry in body["groups"])


async def test_a_published_contact_in_each_of_the_nine_categories_is_in_its_own_group(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    # The contacts exist only in this test's own database; the seed and the migration add none
    # (owner, 2026-10-22).
    for position, slug in enumerate(GROUP_SLUGS):
        await add_listing(session, f"Test Contact {position}", category_slug=slug, area="Ogui")

    body = await get_emergency(client)

    for position, slug in enumerate(GROUP_SLUGS):
        assert contact_names(body, slug) == [f"Test Contact {position}"], slug


async def test_a_draft_contact_in_a_new_group_is_left_out(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    await add_listing(
        session, "Draft Flood Desk", category_slug="disaster-flooding", status=ListingStatus.draft
    )
    await add_listing(
        session, "Hidden Support Line", category_slug="gbv-support", status=ListingStatus.hidden
    )

    body = await get_emergency(client)

    assert contact_names(body, "disaster-flooding") == []
    assert contact_names(body, "gbv-support") == []


async def test_a_blood_bank_is_nowhere_in_the_answer_it_is_listed_by_blood_banks_only(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    """Decision M1 (2026-10-22): `/blood` is the only list of blood banks; SwiftRescue links to it."""
    await add_listing(session, "Central Blood Bank", category_slug="blood-bank", area="Ogui")
    await add_listing(session, "Fine Ambulance", category_slug="ambulance")
    await session.commit()

    response = await client.get("/emergency", params={"lat": MY_LATITUDE, "lng": MY_LONGITUDE})
    blood = await client.get("/blood/banks")

    body = response.json()
    assert "blood-bank" not in [entry["category"]["slug"] for entry in body["groups"]]
    assert "Central Blood Bank" not in response.text
    assert contact_names(body, "ambulance") == ["Fine Ambulance"]  # the other groups are not affected
    assert [item["name"] for item in blood.json()["items"]] == ["Central Blood Bank"]  # still found on /blood


async def test_a_contact_is_in_its_own_group_with_the_listing_summary_shape(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    verified = TUESDAY_10_00_IN_LAGOS - timedelta(days=2)
    await add_listing(
        session, "Enugu Ambulance Unit", category_slug="ambulance", area="Ogui", phone="+2340000000555",
        is_24_hours=True, last_verified_at=verified, next_check_due=verified + timedelta(days=14),
    )
    await session.commit()
    body = await get_emergency(client)
    assert contact_names(body, "ambulance") == ["Enugu Ambulance Unit"]
    assert contact_names(body, "fire") == []
    contact = group(body, "ambulance")["contacts"][0]
    assert contact["primary_phone"] == "+2340000000555"  # FR-16
    assert contact["area"] == "Ogui"
    assert contact["last_verified_at"] == "2026-10-04T09:00:00Z"
    assert contact["verification_due"] is False
    assert contact["distance_km"] is None  # no location sent
    assert contact["is_open_now"] is True  # a 24-hour listing (decision A4)
    assert contact["hours_note"] is None  # 24 hours: nothing changes


async def test_contacts_are_nearest_first_with_a_location_and_by_name_without(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    await add_listing(session, "Zeta Police Post", category_slug="police", latitude=6.4510, longitude=7.5090)
    await add_listing(session, "Alpha Police Post", category_slug="police", latitude=6.5500, longitude=7.6000)
    await session.commit()
    nearest_first = await get_emergency(client, lat=MY_LATITUDE, lng=MY_LONGITUDE)
    assert contact_names(nearest_first, "police") == ["Zeta Police Post", "Alpha Police Post"]
    assert group(nearest_first, "police")["contacts"][0]["distance_km"] == 0.2
    by_name = await get_emergency(client)
    assert contact_names(by_name, "police") == ["Alpha Police Post", "Zeta Police Post"]


async def test_the_other_categories_are_not_in_the_groups(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    await add_listing(session, "Some Clinic", category_slug="clinic")
    await add_listing(session, "Some Hospital", category_slug="hospital")
    await session.commit()
    body = await get_emergency(client)
    assert all(entry["contacts"] == [] for entry in body["groups"])


@pytest.mark.parametrize("status", [s for s in ListingStatus if s is not ListingStatus.published])
async def test_a_listing_that_is_not_published_is_never_returned(
    client: AsyncClient, session: AsyncSession, clock: None, status: ListingStatus
) -> None:
    await add_listing(session, "Hidden Ambulance", category_slug="ambulance", status=status)
    await session.commit()
    body = await get_emergency(client)
    assert contact_names(body, "ambulance") == []


async def test_an_overdue_contact_is_still_shown_with_verification_due(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    await add_listing(
        session, "Old Fire Station", category_slug="fire",
        last_verified_at=TUESDAY_10_00_IN_LAGOS - timedelta(days=20),
        next_check_due=TUESDAY_10_00_IN_LAGOS - timedelta(days=6),
    )
    await session.commit()
    body = await get_emergency(client)
    assert group(body, "fire")["contacts"][0]["verification_due"] is True  # FR-08, trust rule 2


async def test_a_contact_reported_not_working_by_two_people_is_left_out(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    flagged = await add_listing(session, "Flagged Security Firm", category_slug="security")
    await add_listing(session, "Fine Security Firm", category_slug="security")
    two_days_ago = TUESDAY_10_00_IN_LAGOS - timedelta(days=2)
    await add_report(session, flagged, "reporter-one", created_at=two_days_ago)
    await add_report(session, flagged, "reporter-two", created_at=two_days_ago)
    await session.commit()
    body = await get_emergency(client)
    assert contact_names(body, "security") == ["Fine Security Firm"]  # FR-22, decision A2


async def test_no_item_is_sponsored_even_when_a_listing_is_featured(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    featured_until = TUESDAY_10_00_IN_LAGOS + timedelta(days=10)
    await add_listing(session, "Featured Ambulance", category_slug="ambulance", featured_until=featured_until)
    await session.commit()
    body = await get_emergency(client)
    assert contact_names(body, "ambulance") == ["Featured Ambulance"]
    everything = [c for entry in body["groups"] for c in entry["contacts"]]
    assert everything and all(item["sponsored"] is False for item in everything)  # FR-19


async def test_there_are_no_pharmacies_in_the_answer_not_even_a_confirmed_24_hour_one(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    """FR-25 was removed on 2026-10-22 (decision K6): SwiftRescue has contacts only."""
    await add_listing(session, "Night Pharmacy", is_24_hours=True, latitude=6.4510, longitude=7.5090)
    await add_listing(session, "24h Clinic", category_slug="clinic", is_24_hours=True)
    await session.commit()

    response = await client.get("/emergency", params={"lat": MY_LATITUDE, "lng": MY_LONGITUDE})

    body = response.json()
    assert "pharmacies_24h" not in body
    assert "Night Pharmacy" not in response.text
    assert all(entry["contacts"] == [] for entry in body["groups"])  # a pharmacy is not in any group


@pytest.mark.parametrize(
    "params", [{"lat": 6.45}, {"lng": 7.5}, {"lat": 91, "lng": 7.5}, {"lat": 6.4, "lng": 181}]
)
async def test_a_half_or_impossible_location_is_422(
    client: AsyncClient, clock: None, params: dict
) -> None:
    response = await client.get("/emergency", params=params)
    assert response.status_code == 422


async def test_the_number_of_queries_does_not_grow_with_the_number_of_contacts(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    from sqlalchemy import event

    counter = {"statements": 0}

    def count(*_arguments: object) -> None:
        counter["statements"] += 1

    async def statements_for_one_request() -> int:
        counter["statements"] = 0
        event.listen(session.bind.sync_engine, "before_cursor_execute", count)
        try:
            await get_emergency(client)
        finally:
            event.remove(session.bind.sync_engine, "before_cursor_execute", count)
        return counter["statements"]

    await add_listing(session, "One Ambulance", category_slug="ambulance")
    await session.commit()
    few = await statements_for_one_request()
    for number in range(8):
        slug = GROUP_SLUGS[number % len(GROUP_SLUGS)]
        await add_listing(session, f"More Contact {number}", category_slug=slug, is_24_hours=True)
        await add_listing(session, f"More Pharmacy {number}", is_24_hours=True)
    await session.commit()
    many = await statements_for_one_request()
    assert many == few
