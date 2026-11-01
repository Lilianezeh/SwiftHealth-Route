"""POST /search: the same search with the position in the body, never in the address.
Requirements: US-01, FR-03, FR-04 to FR-06, NFR-07. Spec: specs/2026-11-01-maps-near-me/.

A visitor's position is private (NFR-07). In a GET it travels in the query string, and a hosting
platform may log the address before our own code can redact it. So the browser sends it in the
BODY of a POST. The answer is the same as GET /search for the same filters. The position is used
for this one request only: not stored, not logged. Every facility here is fictional.
"""

import logging

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from tests.factories import add_listing

pytestmark = pytest.mark.anyio

ME = {"lat": 6.4500, "lng": 7.5080}


async def three_pharmacies(session: AsyncSession) -> None:
    await add_listing(session, "Far Pharmacy", latitude=6.5200, longitude=7.5080)  # 7.8 km: inside 10 km
    await add_listing(session, "Near Pharmacy", latitude=6.4530, longitude=7.5080)
    await add_listing(session, "Middle Pharmacy", latitude=6.4800, longitude=7.5080)
    await session.commit()


async def test_post_search_with_a_position_answers_nearest_first_with_the_distance(
    client: AsyncClient, session: AsyncSession
):
    await three_pharmacies(session)

    response = await client.post("/search", json={"category": "pharmacy", **ME})

    assert response.status_code == 200
    body = response.json()
    assert [item["name"] for item in body["items"]] == ["Near Pharmacy", "Middle Pharmacy", "Far Pharmacy"]
    distances = [item["distance_km"] for item in body["items"]]
    assert distances == sorted(distances) and distances[0] == 0.3
    assert body["total"] == 3


async def test_post_search_gives_the_same_answer_as_get_search_for_the_same_filters(
    client: AsyncClient, session: AsyncSession
):
    await three_pharmacies(session)

    got = await client.get("/search", params={"category": "pharmacy", "limit": 2, "offset": 1, **ME})
    posted = await client.post("/search", json={"category": "pharmacy", "limit": 2, "offset": 1, **ME})

    assert posted.json() == got.json()


async def test_post_search_reads_the_short_name_q_and_every_filter_from_the_body(
    client: AsyncClient, session: AsyncSession
):
    await three_pharmacies(session)
    await add_listing(session, "Night Clinic", category_slug="clinic", latitude=6.4510, longitude=7.5080)
    await session.commit()

    by_text = await client.post("/search", json={"q": "night", **ME})
    by_radius = await client.post("/search", json={"category": "pharmacy", "radius_km": 1, **ME})

    assert [item["name"] for item in by_text.json()["items"]] == ["Night Clinic"]
    assert [item["name"] for item in by_radius.json()["items"]] == ["Near Pharmacy"]


async def test_post_search_works_without_a_position_too(client: AsyncClient, session: AsyncSession):
    await three_pharmacies(session)

    response = await client.post("/search", json={"category": "pharmacy"})

    assert response.status_code == 200
    assert {item["distance_km"] for item in response.json()["items"]} == {None}


@pytest.mark.parametrize(
    "body",
    [
        {"lat": 6.45},  # both or neither
        {"lng": 7.5},
        {"lat": 91, "lng": 7.5},
        {"lat": 6.45, "lng": 181},
        {"lat": 6.45, "lng": 7.5, "radius_km": 51},
        {"lat": 6.45, "lng": 7.5, "limit": 0},
        {"area": "Atlantis"},
    ],
)
async def test_post_search_refuses_a_bad_body_like_get_search_does(client: AsyncClient, body: dict):
    assert (await client.post("/search", json=body)).status_code == 422


async def test_the_position_is_not_in_the_address_and_not_in_any_log(
    client: AsyncClient, session: AsyncSession, caplog: pytest.LogCaptureFixture
):
    await three_pharmacies(session)
    caplog.set_level(logging.DEBUG)

    response = await client.post("/search", json={"category": "pharmacy", "lat": 6.45123, "lng": 7.50987})

    assert response.status_code == 200
    assert str(response.request.url).endswith("/search")  # nothing after the path
    assert "6.45123" not in caplog.text and "7.50987" not in caplog.text
    assert "6.45123" not in response.text and "7.50987" not in response.text  # and not echoed back


async def test_a_422_does_not_echo_the_position_back(client: AsyncClient):
    response = await client.post("/search", json={"lat": 6.45123})  # lng missing

    assert response.status_code == 422
    assert "6.45123" not in response.text
