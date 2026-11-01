"""POST /blood/banks, POST /blood/donation-centres and POST /emergency: the position in the body.
Requirements: US-04, US-15, US-16, FR-14, FR-27, FR-28, NFR-07.
Spec: specs/2026-11-01-position-in-body-blood-emergency/.

As for POST /search (specs/2026-11-01-maps-near-me/), a visitor's position is private (NFR-07). In a GET it is
in the query string, which a hosting platform may log before our own code can redact it. So the browser sends
it in the BODY of a POST. Each answer is the same as the GET for the same fields. The position is used for
this one request only: not stored, not logged, and a 422 never repeats it. Every facility here is fictional.
"""

import logging
from collections.abc import Iterator
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment
from app.main import app
from app.models import Service
from tests.factories import add_listing

pytestmark = pytest.mark.anyio

NOW = datetime(2026, 10, 6, 9, 0, tzinfo=timezone.utc)
ME = {"lat": 6.4500, "lng": 7.5080}
ROUTES = ["/blood/banks", "/blood/donation-centres", "/emergency"]


@pytest.fixture(autouse=True)
def clock() -> Iterator[None]:
    app.dependency_overrides[get_current_moment] = lambda: NOW
    yield
    app.dependency_overrides.pop(get_current_moment, None)


def groups(*names: str) -> list[Service]:
    return [Service(listing_id=0, name=name) for name in names]


async def places(session: AsyncSession) -> None:
    """Blood banks that also take donations, and emergency contacts, near and far."""
    for name, latitude in (("Far Bank", 6.5200), ("Near Bank", 6.4530), ("Middle Bank", 6.4800)):
        await add_listing(
            session,
            name,
            category_slug="blood-bank",
            latitude=latitude,
            longitude=7.5080,
            services=groups("O+", "A+", "Blood donation"),
        )
    for name, latitude in (("Far Ambulance", 6.5200), ("Near Ambulance", 6.4530)):
        await add_listing(session, name, category_slug="ambulance", latitude=latitude, longitude=7.5080)
    await session.commit()


def names(body: dict) -> list[str]:
    if "groups" in body:
        return [item["name"] for group in body["groups"] for item in group["contacts"]]
    return [item["name"] for item in body["items"]]


@pytest.mark.parametrize("path", ROUTES)
async def test_the_post_gives_the_same_answer_as_the_get_for_the_same_fields(
    client: AsyncClient, session: AsyncSession, path: str
) -> None:
    await places(session)

    got = await client.get(path, params=ME)
    posted = await client.post(path, json=ME)

    assert posted.status_code == 200, posted.text
    assert posted.json() == got.json()


async def test_the_blood_banks_post_answers_nearest_first_and_reads_the_filters_from_the_body(
    client: AsyncClient, session: AsyncSession
) -> None:
    await places(session)

    posted = await client.post("/blood/banks", json={**ME, "blood_group": "O+", "limit": 2, "offset": 0})
    paged = await client.post("/blood/banks", json={**ME, "limit": 1, "offset": 1})

    assert names(posted.json()) == ["Near Bank", "Middle Bank"]
    assert posted.json()["total"] == 3
    assert names(paged.json()) == ["Middle Bank"]


async def test_the_donation_centres_post_answers_nearest_first(
    client: AsyncClient, session: AsyncSession
) -> None:
    await places(session)

    posted = await client.post("/blood/donation-centres", json=ME)

    assert names(posted.json()) == ["Near Bank", "Middle Bank", "Far Bank"]


async def test_the_emergency_post_puts_the_nearest_contact_first_and_112_stays_first(
    client: AsyncClient, session: AsyncSession
) -> None:
    await places(session)

    posted = (await client.post("/emergency", json=ME)).json()

    ambulance = next(group for group in posted["groups"] if group["category"]["slug"] == "ambulance")
    assert [item["name"] for item in ambulance["contacts"]] == ["Near Ambulance", "Far Ambulance"]
    assert posted["national_line"]["number"] == "112"


@pytest.mark.parametrize("path", ROUTES)
async def test_every_post_works_without_a_position_too(
    client: AsyncClient, session: AsyncSession, path: str
) -> None:
    await places(session)

    assert (await client.post(path, json={})).status_code == 200


@pytest.mark.parametrize("path", ROUTES)
@pytest.mark.parametrize(
    "body",
    [
        {"lat": 6.45},
        {"lng": 7.5},
        {"lat": 91, "lng": 7.5},
        {"lat": 6.45, "lng": 181},
        {"lat": "north", "lng": 7.5},
    ],
)
async def test_every_post_refuses_a_bad_position_like_the_get_does(
    client: AsyncClient, path: str, body: dict
) -> None:
    assert (await client.post(path, json=body)).status_code == 422


@pytest.mark.parametrize("body", [{"blood_group": "Z+"}, {"limit": 0}, {"limit": 101}, {"offset": -1}])
async def test_the_blood_banks_post_refuses_a_bad_filter(client: AsyncClient, body: dict) -> None:
    assert (await client.post("/blood/banks", json=body)).status_code == 422


@pytest.mark.parametrize("path", ROUTES)
async def test_the_position_is_not_in_the_address_not_in_any_log_and_not_echoed(
    client: AsyncClient, session: AsyncSession, caplog: pytest.LogCaptureFixture, path: str
) -> None:
    await places(session)
    caplog.set_level(logging.DEBUG)

    response = await client.post(path, json={"lat": 6.45123, "lng": 7.50987})

    assert response.status_code == 200
    assert str(response.request.url).endswith(path)  # nothing after the path
    assert "6.45123" not in caplog.text and "7.50987" not in caplog.text
    assert "6.45123" not in response.text and "7.50987" not in response.text


@pytest.mark.parametrize("path", ROUTES)
async def test_a_422_does_not_echo_the_position_back(client: AsyncClient, path: str) -> None:
    response = await client.post(path, json={"lat": 6.45123})  # lng missing

    assert response.status_code == 422
    assert "6.45123" not in response.text
