"""The sponsored slot of GET /search. Requirements: FR-45, FR-19, FR-44. Contract: specs/backend/api-spec.md,
section 3 (rule 4) and "Phase 12 rules". Decision I11 in specs/2026-10-20-providers-payments/requirements.md.
The clock is replaced with a fixed moment. All names and places are fictional.
"""

from collections.abc import Iterator
from datetime import datetime, time, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment
from app.main import app
from app.models.base import ListingStatus
from app.repositories import category_repository
from tests.factories import add_listing, add_report, every_day

pytestmark = pytest.mark.anyio

NOW = datetime(2026, 10, 6, 9, 0, tzinfo=timezone.utc)  # Tuesday 10:00 in Lagos
FEATURED = NOW + timedelta(days=10)
HERE = (6.4500, 7.5080)


@pytest.fixture
def clock() -> Iterator[None]:
    app.dependency_overrides[get_current_moment] = lambda: NOW
    yield
    app.dependency_overrides.pop(get_current_moment, None)


async def search(client: AsyncClient, **params: object) -> dict:
    response = await client.get("/search", params=params)
    assert response.status_code == 200, response.text
    return response.json()


def names(body: dict) -> list[str]:
    return [item["name"] for item in body["items"]]


def sponsored(body: dict) -> list[str]:
    return [item["name"] for item in body["items"] if item["sponsored"]]


async def place(session: AsyncSession, name: str, km_north: float, **kwargs: object):
    """A pharmacy `km_north` kilometres north of HERE (0.009 degrees of latitude is about 1 km)."""
    return await add_listing(session, name, latitude=HERE[0] + km_north * 0.009, longitude=HERE[1], **kwargs)


async def test_nobody_is_sponsored_when_nobody_is_featured(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    await place(session, "Near", 1)
    await place(session, "Far", 3)
    await session.commit()

    body = await search(client, lat=HERE[0], lng=HERE[1])

    assert names(body) == ["Near", "Far"]
    assert sponsored(body) == []


async def test_a_featured_listing_comes_first_with_sponsored_true_even_when_it_is_farther(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    await place(session, "Near", 1)
    await place(session, "Middle", 2)
    await place(session, "Featured Far", 4, featured_until=FEATURED)
    await session.commit()

    body = await search(client, lat=HERE[0], lng=HERE[1])

    assert names(body) == ["Featured Far", "Near", "Middle"]
    assert sponsored(body) == ["Featured Far"]
    assert body["items"][0]["distance_km"] == pytest.approx(4.0, abs=0.1)  # the real distance, not hidden


async def test_it_is_not_repeated_lower_down_and_the_total_does_not_change(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    await place(session, "Near", 1)
    await place(session, "Featured", 2, featured_until=FEATURED)
    await place(session, "Far", 3)
    await session.commit()
    plain = await search(client, lat=HERE[0], lng=HERE[1], limit=100)

    body = await search(client, lat=HERE[0], lng=HERE[1], limit=100)

    assert names(body).count("Featured") == 1
    assert body["total"] == 3 == len(body["items"])
    assert sorted(names(body)) == sorted(names(plain))


async def test_the_slot_works_without_a_position_and_goes_by_name(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    await place(session, "Alpha", 1)
    await place(session, "Zulu Featured", 2, featured_until=FEATURED)
    await session.commit()

    body = await search(client)

    assert names(body) == ["Zulu Featured", "Alpha"]
    assert sponsored(body) == ["Zulu Featured"]


async def test_with_two_featured_listings_only_the_first_in_the_normal_order_is_sponsored(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    await place(session, "Near", 1)
    await place(session, "Featured Close", 2, featured_until=FEATURED)
    await place(session, "Featured Distant", 5, featured_until=FEATURED + timedelta(days=20))
    await session.commit()

    body = await search(client, lat=HERE[0], lng=HERE[1])

    assert names(body) == ["Featured Close", "Near", "Featured Distant"]
    assert sponsored(body) == ["Featured Close"]  # at most one (FR-45)


@pytest.mark.parametrize("delta", [timedelta(days=-1), timedelta(0)])
async def test_a_period_that_has_ended_or_ends_now_is_not_sponsored(
    client: AsyncClient, session: AsyncSession, clock: None, delta: timedelta
) -> None:
    await place(session, "Near", 1)
    await place(session, "Ended", 2, featured_until=NOW + delta)
    await session.commit()

    body = await search(client, lat=HERE[0], lng=HERE[1])

    assert names(body) == ["Near", "Ended"]
    assert sponsored(body) == []


async def test_a_featured_listing_that_does_not_match_the_search_is_not_shown_or_sponsored(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    await place(session, "Night Pharmacy", 1)
    await place(session, "Clinic Without Match", 2, featured_until=FEATURED, service_names=("X-ray",))
    await session.commit()

    body = await search(client, q="Night Pharmacy")

    assert names(body) == ["Night Pharmacy"]
    assert sponsored(body) == []


async def test_a_featured_listing_outside_the_radius_is_not_sponsored(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    await place(session, "Near", 1)
    await place(session, "Featured Far Away", 30, featured_until=FEATURED)
    await session.commit()

    body = await search(client, lat=HERE[0], lng=HERE[1], radius_km=10)

    assert names(body) == ["Near"]
    assert sponsored(body) == []


async def test_a_closed_featured_listing_is_not_sponsored_when_the_search_asks_for_open_now(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    await place(session, "Open", 1, opening_hours=every_day(time(0, 0), time(23, 0)))
    await place(
        session,
        "Featured Closed",
        2,
        featured_until=FEATURED,
        opening_hours=every_day(time(1, 0), time(2, 0)),
    )
    await session.commit()

    body = await search(client, lat=HERE[0], lng=HERE[1], open_now=True)

    assert names(body) == ["Open"]
    assert sponsored(body) == []


async def test_an_emergency_category_is_never_sponsored(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    await category_repository.create(
        session, name="Ambulance", slug="ambulance", is_emergency=True, recheck_days=14
    )
    await place(session, "Near", 1)
    await place(session, "Featured Ambulance", 2, category_slug="ambulance", featured_until=FEATURED)
    await session.commit()

    body = await search(client, lat=HERE[0], lng=HERE[1])

    assert sponsored(body) == []
    assert "Featured Ambulance" in names(body)


async def test_the_next_featured_listing_is_sponsored_when_the_first_is_an_emergency_one(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    await category_repository.create(
        session, name="Ambulance", slug="ambulance", is_emergency=True, recheck_days=14
    )
    await place(session, "Featured Ambulance", 1, category_slug="ambulance", featured_until=FEATURED)
    await place(session, "Featured Pharmacy", 3, featured_until=FEATURED)
    await session.commit()

    body = await search(client, lat=HERE[0], lng=HERE[1])

    assert sponsored(body) == ["Featured Pharmacy"]
    assert names(body)[0] == "Featured Pharmacy"


@pytest.mark.parametrize(
    "status",
    [ListingStatus.draft, ListingStatus.pending_review, ListingStatus.hidden, ListingStatus.recheck_due],
)
async def test_a_listing_that_is_not_published_is_never_shown_even_if_it_is_featured(
    client: AsyncClient, session: AsyncSession, clock: None, status: ListingStatus
) -> None:
    await place(session, "Near", 1)
    await place(session, "Featured But Not Public", 2, status=status, featured_until=FEATURED)
    await session.commit()

    body = await search(client, lat=HERE[0], lng=HERE[1])

    assert names(body) == ["Near"]
    assert sponsored(body) == []


async def test_a_featured_listing_flagged_as_not_working_by_two_people_is_left_out(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    await place(session, "Near", 1)
    flagged = await place(session, "Featured Flagged", 2, featured_until=FEATURED)
    await add_report(session, flagged, "key-one", created_at=NOW - timedelta(days=1))
    await add_report(session, flagged, "key-two", created_at=NOW - timedelta(days=2))
    await session.commit()

    body = await search(client, lat=HERE[0], lng=HERE[1])

    assert names(body) == ["Near"]
    assert sponsored(body) == []


async def test_the_slot_is_on_the_first_page_only_and_the_pages_add_up(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    for number in range(1, 6):
        await place(session, f"Organic {number}", number)
    await place(session, "Featured", 7, featured_until=FEATURED)
    await session.commit()

    first = await search(client, lat=HERE[0], lng=HERE[1], limit=2, offset=0)
    second = await search(client, lat=HERE[0], lng=HERE[1], limit=2, offset=2)
    third = await search(client, lat=HERE[0], lng=HERE[1], limit=2, offset=4)

    assert names(first) == ["Featured", "Organic 1"]
    assert names(second) == ["Organic 2", "Organic 3"]
    assert names(third) == ["Organic 4", "Organic 5"]
    assert sponsored(second) == sponsored(third) == []
    assert first["total"] == second["total"] == third["total"] == 6


# --- never outside /search (FR-19) ---


async def test_a_featured_blood_bank_is_not_sponsored_on_the_blood_pages(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    await category_repository.create(
        session, name="Blood bank", slug="blood-bank", is_emergency=True, recheck_days=14
    )
    await place(session, "Featured Bank", 1, category_slug="blood-bank", featured_until=FEATURED)
    await place(session, "Other Bank", 2, category_slug="blood-bank")
    await session.commit()

    banks = (await client.get("/blood/banks")).json()

    assert [item["sponsored"] for item in banks["items"]] == [False, False]


async def test_a_featured_listing_is_not_sponsored_on_its_own_page_or_in_the_emergency_list(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    await category_repository.create(
        session, name="Ambulance", slug="ambulance", is_emergency=True, recheck_days=14
    )
    await place(session, "Featured Pharmacy", 1, featured_until=FEATURED)
    await place(session, "Featured Ambulance", 2, category_slug="ambulance", featured_until=FEATURED)
    await session.commit()

    page = (await client.get("/listings/featured-pharmacy")).json()
    emergency = (await client.get("/emergency")).json()

    assert page["sponsored"] is False
    every_item = [item for group in emergency["groups"] for item in group["contacts"]] + emergency[
        "pharmacies_24h"
    ]
    assert every_item  # the featured ambulance is in the list ...
    assert all(item["sponsored"] is False for item in every_item)  # ... and not sponsored
