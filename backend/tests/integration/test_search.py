"""GET /search through HTTP. Requirements: US-01, US-05, FR-04, FR-05, FR-06, FR-08, FR-22, NFR-02.

The contract is specs/backend/api-spec.md, "GET /search". The clock is replaced with a fixed moment, so the
open-now tests do not depend on the time the suite runs. Decisions 7 to 12 in
specs/2026-10-09-search-backend/requirements.md.
"""
from collections.abc import Iterator
from datetime import datetime, time, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment
from app.main import app
from app.models.base import ListingStatus
from tests.factories import add_listing, add_report, every_day

pytestmark = pytest.mark.anyio

TUESDAY_10_00_IN_LAGOS = datetime(2026, 10, 6, 9, 0, tzinfo=timezone.utc)  # Lagos is UTC+1
MY_LATITUDE, MY_LONGITUDE = 6.4500, 7.5080

SUMMARY_FIELDS = {
    "id", "slug", "name", "category", "area", "address", "latitude", "longitude", "distance_km",
    "is_open_now", "is_24_hours", "primary_phone", "last_verified_at", "verification_due", "sponsored",
}


@pytest.fixture
def clock() -> Iterator[list[datetime]]:
    """Fixes the moment the route sees. A test changes it with `clock[0] = ...`. Removed after the test."""
    moment = [TUESDAY_10_00_IN_LAGOS]
    app.dependency_overrides[get_current_moment] = lambda: moment[0]
    yield moment
    app.dependency_overrides.pop(get_current_moment, None)


async def search(client: AsyncClient, **params: object) -> dict:
    response = await client.get("/search", params=params)
    assert response.status_code == 200, response.text
    return response.json()


def names(body: dict) -> list[str]:
    return [item["name"] for item in body["items"]]


async def test_search_needs_no_login(client: AsyncClient, clock: list[datetime]) -> None:
    response = await client.get("/search")  # no Authorization header
    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 0}


async def test_search_returns_items_and_total_in_the_listing_summary_shape(
    client: AsyncClient, session: AsyncSession, clock: list[datetime]
) -> None:
    verified = TUESDAY_10_00_IN_LAGOS - timedelta(days=3)
    await add_listing(
        session, "Night Pharmacy A", area="New Haven", latitude=6.4520, longitude=7.5100,
        phone="+2340000000012", opening_hours=every_day(time(0, 0), time(23, 0)), last_verified_at=verified,
        next_check_due=verified + timedelta(days=45),
    )
    await session.commit()
    body = await search(client, lat=MY_LATITUDE, lng=MY_LONGITUDE)
    assert body["total"] == 1
    assert set(body) == {"items", "total"}
    item = body["items"][0]
    assert set(item) == SUMMARY_FIELDS
    assert item["slug"] == "night-pharmacy-a"
    assert item["category"] == {"slug": "pharmacy", "name": "Pharmacy"}
    assert item["area"] == "New Haven"
    assert item["distance_km"] == 0.3
    assert item["is_open_now"] is True
    assert item["primary_phone"] == "+2340000000012"
    assert item["last_verified_at"] == "2026-10-03T09:00:00Z"
    assert item["verification_due"] is False


@pytest.mark.parametrize("params", [{"lat": 6.45}, {"lng": 7.5}])
async def test_lat_without_lng_or_lng_without_lat_is_422(
    client: AsyncClient, clock: list[datetime], params: dict
) -> None:
    response = await client.get("/search", params=params)
    assert response.status_code == 422


@pytest.mark.parametrize(
    "params",
    [
        {"radius_km": 51}, {"radius_km": 0}, {"radius_km": -1},
        {"limit": 101}, {"limit": 0}, {"offset": -1},
        {"lat": 91, "lng": 7.5}, {"lat": 6.4, "lng": 181},
        {"q": "a" * 101}, {"category": "a" * 101}, {"service": "a" * 101},
        {"open_now": "maybe"},
    ],
)
async def test_values_outside_the_spec_are_422(
    client: AsyncClient, clock: list[datetime], params: dict
) -> None:
    response = await client.get("/search", params=params)
    assert response.status_code == 422


async def test_the_largest_allowed_values_are_accepted(client: AsyncClient, clock: list[datetime]) -> None:
    body = await search(client, lat=6.45, lng=7.5, radius_km=50, limit=100, offset=0, q="a" * 100)
    assert body == {"items": [], "total": 0}


async def test_unknown_area_is_422_and_a_listed_area_works(
    client: AsyncClient, session: AsyncSession, clock: list[datetime]
) -> None:
    await add_listing(session, "Ogui Place", area="Ogui")
    await session.commit()
    assert (await client.get("/search", params={"area": "Atlantis"})).status_code == 422
    assert names(await search(client, area="Ogui")) == ["Ogui Place"]


async def test_unknown_category_and_service_return_an_empty_list(
    client: AsyncClient, session: AsyncSession, clock: list[datetime]
) -> None:
    await add_listing(session, "Ogui Place")
    await session.commit()
    assert await search(client, category="no-such-category") == {"items": [], "total": 0}
    assert await search(client, service="no-such-service") == {"items": [], "total": 0}


async def test_category_and_service_filters(
    client: AsyncClient, session: AsyncSession, clock: list[datetime]
) -> None:
    await add_listing(session, "Scan Centre", category_slug="lab", service_names=("X-ray",))
    await add_listing(session, "Basic Pharmacy")
    await session.commit()
    assert names(await search(client, category="lab")) == ["Scan Centre"]
    assert names(await search(client, service="X-ray")) == ["Scan Centre"]  # US-05


async def test_open_now_uses_lagos_time(
    client: AsyncClient, session: AsyncSession, clock: list[datetime]
) -> None:
    # Monday 23:30 UTC is already Tuesday 00:30 in Lagos: the Tuesday-only listing is open, the other is not.
    tuesday_only = [row for row in every_day(time(0, 0), time(6, 0)) if row.day_of_week == 1]
    monday_only = [row for row in every_day(time(20, 0), time(23, 45)) if row.day_of_week == 0]
    await add_listing(session, "Tuesday Early Pharmacy", opening_hours=tuesday_only)
    await add_listing(session, "Monday Evening Pharmacy", opening_hours=monday_only)
    await session.commit()
    clock[0] = datetime(2026, 10, 5, 23, 30, tzinfo=timezone.utc)
    assert names(await search(client, open_now="true")) == ["Tuesday Early Pharmacy"]


async def test_open_now_past_midnight_through_the_route(
    client: AsyncClient, session: AsyncSession, clock: list[datetime]
) -> None:
    await add_listing(session, "Night Pharmacy A", opening_hours=every_day(time(20, 0), time(2, 0)))
    await session.commit()
    clock[0] = datetime(2026, 10, 6, 0, 30, tzinfo=timezone.utc)  # 01:30 in Lagos
    assert names(await search(client, open_now="true")) == ["Night Pharmacy A"]
    clock[0] = datetime(2026, 10, 6, 2, 0, tzinfo=timezone.utc)  # 03:00 in Lagos
    assert names(await search(client, open_now="true")) == []


async def test_open_24_hours_filter(
    client: AsyncClient, session: AsyncSession, clock: list[datetime]
) -> None:
    await add_listing(session, "Day Pharmacy")
    await add_listing(session, "Round The Clock Pharmacy", is_24_hours=True)
    await session.commit()
    assert names(await search(client, is_24_hours="true")) == ["Round The Clock Pharmacy"]


async def test_search_without_location_sorts_by_name_and_distance_is_null(
    client: AsyncClient, session: AsyncSession, clock: list[datetime]
) -> None:
    await add_listing(session, "Zeta Pharmacy", latitude=6.4501, longitude=7.5081)
    await add_listing(session, "Alpha Pharmacy", latitude=6.6, longitude=7.8)
    await session.commit()
    body = await search(client)
    assert names(body) == ["Alpha Pharmacy", "Zeta Pharmacy"]
    assert [item["distance_km"] for item in body["items"]] == [None, None]


async def test_search_with_location_sorts_nearest_first(
    client: AsyncClient, session: AsyncSession, clock: list[datetime]
) -> None:
    await add_listing(session, "Far Pharmacy", latitude=6.4700, longitude=7.5300)
    await add_listing(session, "Near Pharmacy", latitude=6.4510, longitude=7.5090)
    await add_listing(session, "Middle Pharmacy", latitude=6.4400, longitude=7.4950)
    await session.commit()
    body = await search(client, lat=MY_LATITUDE, lng=MY_LONGITUDE)
    assert names(body) == ["Near Pharmacy", "Middle Pharmacy", "Far Pharmacy"]
    distances = [item["distance_km"] for item in body["items"]]
    assert distances == sorted(distances)


async def test_radius_km_limits_the_distance(
    client: AsyncClient, session: AsyncSession, clock: list[datetime]
) -> None:
    await add_listing(session, "Near Pharmacy", latitude=6.4510, longitude=7.5080)
    await add_listing(session, "Far Pharmacy", latitude=6.5500, longitude=7.5080)  # about 11 km
    await session.commit()
    default_radius = await search(client, lat=MY_LATITUDE, lng=MY_LONGITUDE)  # 10 km
    assert names(default_radius) == ["Near Pharmacy"]
    assert names(await search(client, lat=MY_LATITUDE, lng=MY_LONGITUDE, radius_km=20)) == [
        "Near Pharmacy", "Far Pharmacy"
    ]


async def test_limit_and_offset_page_the_results_and_total_stays(
    client: AsyncClient, session: AsyncSession, clock: list[datetime]
) -> None:
    for name in ("A Pharmacy", "B Pharmacy", "C Pharmacy"):
        await add_listing(session, name)
    await session.commit()
    body = await search(client, limit=1, offset=1)
    assert names(body) == ["B Pharmacy"]
    assert body["total"] == 3


async def test_overdue_listing_appears_with_verification_due_true(
    client: AsyncClient, session: AsyncSession, clock: list[datetime]
) -> None:
    await add_listing(
        session, "Overdue Clinic", category_slug="clinic",
        last_verified_at=TUESDAY_10_00_IN_LAGOS - timedelta(days=60),
        next_check_due=TUESDAY_10_00_IN_LAGOS - timedelta(days=15),
    )
    await session.commit()
    body = await search(client)
    assert names(body) == ["Overdue Clinic"]  # FR-08: shown, not hidden
    assert body["items"][0]["verification_due"] is True


async def test_flagged_listing_is_missing_from_the_results(
    client: AsyncClient, session: AsyncSession, clock: list[datetime]
) -> None:
    flagged = await add_listing(session, "Flagged Pharmacy")
    await add_listing(session, "Fine Pharmacy")
    for reporter_key in ("key-a", "key-b"):
        await add_report(
            session, flagged, reporter_key, created_at=TUESDAY_10_00_IN_LAGOS - timedelta(days=2)
        )
    await session.commit()
    assert names(await search(client)) == ["Fine Pharmacy"]


@pytest.mark.parametrize(
    "status",
    [ListingStatus.draft, ListingStatus.pending_review, ListingStatus.hidden, ListingStatus.recheck_due],
)
async def test_a_listing_that_is_not_published_is_never_returned(
    client: AsyncClient, session: AsyncSession, clock: list[datetime], status: ListingStatus
) -> None:
    await add_listing(session, "Not Public Pharmacy", status=status)
    await session.commit()
    body = await search(client, q="Not Public Pharmacy")
    assert body == {"items": [], "total": 0}
    assert (await search(client)) == {"items": [], "total": 0}


async def test_misspelled_q_finds_the_right_listing_and_an_unrelated_q_finds_nothing(
    client: AsyncClient, session: AsyncSession, clock: list[datetime]
) -> None:
    await add_listing(session, "Ogui Road Pharmacy", area="Ogui")
    await add_listing(session, "Uwani Maternity Home", area="Uwani", category_slug="maternity")
    await session.commit()
    assert names(await search(client, q="pharmcy")) == ["Ogui Road Pharmacy"]
    assert names(await search(client, q="Uwani Maternty")) == ["Uwani Maternity Home"]
    assert names(await search(client, q="Ogui Rod Pharmcy")) == ["Ogui Road Pharmacy"]  # two typos
    assert names(await search(client, q="pharmcy ogui")) == ["Ogui Road Pharmacy"]  # name word, area word
    assert await search(client, q="banana") == {"items": [], "total": 0}
    assert await search(client, q="airline ticket") == {"items": [], "total": 0}


async def test_a_blank_q_is_the_same_as_no_q(
    client: AsyncClient, session: AsyncSession, clock: list[datetime]
) -> None:
    await add_listing(session, "Ogui Road Pharmacy")
    await session.commit()
    assert names(await search(client, q="")) == ["Ogui Road Pharmacy"]
    assert names(await search(client, q="   ")) == ["Ogui Road Pharmacy"]


@pytest.mark.parametrize(
    "query", ["'; DROP TABLE listings; --", "100%", "under_score", "\\", "ünïcode", "%00"]
)
async def test_q_with_odd_characters_returns_200_and_keeps_the_data(
    client: AsyncClient, session: AsyncSession, clock: list[datetime], query: str
) -> None:
    await add_listing(session, "Ogui Road Pharmacy")
    await session.commit()
    response = await client.get("/search", params={"q": query})
    assert response.status_code == 200
    assert names(await search(client)) == ["Ogui Road Pharmacy"]  # the table is intact


async def test_sponsored_is_false_on_every_item(
    client: AsyncClient, session: AsyncSession, clock: list[datetime]
) -> None:
    await add_listing(session, "Zulu Pharmacy", featured_until=TUESDAY_10_00_IN_LAGOS + timedelta(days=10))
    await add_listing(session, "Alpha Pharmacy")
    await session.commit()
    body = await search(client)
    assert names(body) == ["Alpha Pharmacy", "Zulu Pharmacy"]  # phase 12c adds the sponsored slot, not this
    assert [item["sponsored"] for item in body["items"]] == [False, False]


async def test_the_response_never_shows_internal_fields(
    client: AsyncClient, session: AsyncSession, clock: list[datetime]
) -> None:
    featured_until = TUESDAY_10_00_IN_LAGOS + timedelta(days=10)
    await add_listing(session, "Ogui Road Pharmacy", featured_until=featured_until)
    await session.commit()
    response = await client.get("/search")
    for hidden_word in ("status", "owner_id", "created_by", "reporter", "featured_until", "password"):
        assert hidden_word not in response.text


async def test_q_is_the_public_name_and_it_is_described_in_docs() -> None:
    # The URL keeps the usual short name `q`; inside the code it is `search_text` (CLAUDE.md, "Code style").
    search_parameters = app.openapi()["paths"]["/search"]["get"]["parameters"]
    parameters = {parameter["name"]: parameter for parameter in search_parameters}
    assert "q" in parameters
    assert "search_text" not in parameters
    description = parameters["q"]["description"]
    assert "facility name" in description and "area" in description and "service" in description


async def test_the_code_name_search_text_is_not_a_second_public_name(
    client: AsyncClient, session: AsyncSession, clock: list[datetime]
) -> None:
    await add_listing(session, "Ogui Road Pharmacy")
    await add_listing(session, "Uwani Maternity Home", category_slug="maternity")
    await session.commit()
    assert names(await search(client, q="maternity")) == ["Uwani Maternity Home"]
    assert len(names(await search(client, search_text="maternity"))) == 2  # ignored: no filter was applied


async def test_a_too_long_q_is_a_422_that_names_q(client: AsyncClient, clock: list[datetime]) -> None:
    response = await client.get("/search", params={"q": "a" * 101})
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"][-1] == "q"


async def test_the_real_clock_is_used_when_nothing_replaces_it(
    client: AsyncClient, session: AsyncSession
) -> None:
    # No `clock` fixture here: the dependency returns the current UTC time, with a time zone.
    moment = get_current_moment()
    assert moment.tzinfo is not None
    assert abs(datetime.now(timezone.utc) - moment) < timedelta(seconds=5)
    assert (await client.get("/search")).status_code == 200
