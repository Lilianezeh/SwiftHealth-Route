"""GET /blood/banks and GET /blood/donation-centres. Requirements: US-15, US-16, FR-27, FR-28, FR-08, FR-19,
FR-22, NFR-07.
The contract is specs/backend/api-spec.md ("Phase 8 rules for both blood endpoints"). Decisions F1 to F5 in
specs/2026-10-20-blood/requirements.md. The clock is replaced with a fixed moment.
"""

from collections.abc import Iterator
from datetime import date, datetime, time, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import event
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment
from app.main import app
from app.models import Service
from app.models.base import ListingStatus
from tests.factories import add_listing, add_report, every_day

pytestmark = pytest.mark.anyio

NOW = datetime(2026, 10, 6, 9, 0, tzinfo=timezone.utc)  # Tuesday 10:00 in Lagos
MY_LATITUDE, MY_LONGITUDE = 6.4500, 7.5080
STOCK_NOTE = "Stock changes daily; call to confirm before you go."


@pytest.fixture
def clock() -> Iterator[None]:
    app.dependency_overrides[get_current_moment] = lambda: NOW
    yield
    app.dependency_overrides.pop(get_current_moment, None)


def groups(*names: str, confirmed: date | None = date(2026, 10, 1)) -> list[Service]:
    return [Service(listing_id=0, name=name, fee_collected_at=confirmed) for name in names]


async def banks(client: AsyncClient, **params: object) -> dict:
    response = await client.get("/blood/banks", params=params)
    assert response.status_code == 200, response.text
    return response.json()


async def centres(client: AsyncClient, **params: object) -> dict:
    response = await client.get("/blood/donation-centres", params=params)
    assert response.status_code == 200, response.text
    return response.json()


def names(body: dict) -> list[str]:
    return [item["name"] for item in body["items"]]


# --- blood banks ---


async def test_blood_banks_need_no_login_and_start_empty(client: AsyncClient, clock: None) -> None:
    assert await banks(client) == {"items": [], "total": 0}


async def test_a_blood_bank_item_is_a_summary_plus_groups_the_confirmed_date_and_the_stock_note(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    verified = NOW - timedelta(days=2)
    await add_listing(
        session,
        "City Blood Bank",
        category_slug="blood-bank",
        area="Ogui",
        phone="+2340000000777",
        opening_hours=every_day(time(8, 0), time(20, 0)),
        services=groups("O+", "A+"),
        last_verified_at=verified,
        next_check_due=verified + timedelta(days=14),
    )
    await session.commit()
    body = await banks(client, lat=MY_LATITUDE, lng=MY_LONGITUDE)
    assert body["total"] == 1
    item = body["items"][0]
    assert item["blood_groups"] == ["A+", "O+"]  # in the order A+, A-, B+, B-, AB+, AB-, O+, O-
    assert item["blood_groups_confirmed_at"] == "2026-10-01"
    assert item["stock_note"] == STOCK_NOTE
    assert item["primary_phone"] == "+2340000000777"
    assert item["is_open_now"] is True
    assert item["hours_note"] == "Closes 8:00 PM"
    assert item["sponsored"] is False
    assert item["distance_km"] is not None
    assert item["category"]["slug"] == "blood-bank"


async def test_groups_come_in_the_fixed_order_whatever_order_they_were_saved_in(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    await add_listing(
        session,
        "Bank",
        category_slug="blood-bank",
        services=groups("O-", "AB+", "B-", "A-", "O+", "B+", "A+", "AB-"),
    )
    await session.commit()
    assert (await banks(client))["items"][0]["blood_groups"] == [
        "A+",
        "A-",
        "B+",
        "B-",
        "AB+",
        "AB-",
        "O+",
        "O-",
    ]


async def test_a_hospital_with_a_blood_bank_service_or_a_blood_group_is_in_and_a_plain_hospital_is_out(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    await add_listing(
        session,
        "Hospital With Bank",
        category_slug="hospital",
        services=[Service(listing_id=0, name="Blood bank")],
    )
    await add_listing(session, "Hospital With Groups", category_slug="hospital", services=groups("O+"))
    await add_listing(session, "Plain Hospital", category_slug="hospital", service_names=("Consultation",))
    await add_listing(
        session, "Clinic", category_slug="clinic", services=[Service(listing_id=0, name="Consultation")]
    )
    await session.commit()
    assert names(await banks(client)) == ["Hospital With Bank", "Hospital With Groups"]


async def test_a_hospital_that_has_only_a_blood_bank_service_has_no_groups_and_no_date(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    await add_listing(
        session,
        "Hospital With Bank",
        category_slug="hospital",
        services=[Service(listing_id=0, name="Blood bank")],
    )
    await session.commit()
    item = (await banks(client))["items"][0]
    assert item["blood_groups"] == []
    assert item["blood_groups_confirmed_at"] is None


async def test_the_service_names_are_matched_in_the_same_way_as_everywhere_else(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    await add_listing(
        session,
        "Hospital",
        category_slug="hospital",
        services=[
            Service(listing_id=0, name=" blood bank "),
            Service(listing_id=0, name="o+"),
        ],
    )
    await session.commit()
    item = (await banks(client))["items"][0]
    assert item["blood_groups"] == ["O+"]


async def test_the_confirmed_date_is_the_newest_date_of_the_group_rows_and_ignores_other_services(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    services = [
        Service(listing_id=0, name="O+", fee_collected_at=date(2026, 9, 1)),
        Service(listing_id=0, name="A+", fee_collected_at=date(2026, 10, 3)),
        Service(listing_id=0, name="B+", fee_collected_at=None),
        Service(listing_id=0, name="Consultation", fee_collected_at=date(2026, 10, 5)),  # not a group
    ]
    await add_listing(session, "Bank", category_slug="blood-bank", services=services)
    await session.commit()
    assert (await banks(client))["items"][0]["blood_groups_confirmed_at"] == "2026-10-03"


async def test_the_group_filter_keeps_only_the_listings_that_offer_that_group(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    await add_listing(session, "Has O+", category_slug="blood-bank", services=groups("O+", "A+"))
    await add_listing(session, "Has A+ only", category_slug="blood-bank", services=groups("A+"))
    await add_listing(session, "No groups", category_slug="blood-bank")
    await session.commit()
    assert names(await banks(client, blood_group="O+")) == ["Has O+"]
    assert names(await banks(client, blood_group="A+")) == ["Has A+ only", "Has O+"]
    assert names(await banks(client)) == ["Has A+ only", "Has O+", "No groups"]
    assert (await banks(client, blood_group="O+"))["items"][0]["blood_groups"] == [
        "A+",
        "O+",
    ]  # all of its groups still shown


@pytest.mark.parametrize("group", ["C+", "o+", "O", "", "AB"])
async def test_a_blood_group_that_is_not_one_of_the_eight_is_422(
    client: AsyncClient, clock: None, group: str
) -> None:
    assert (await client.get("/blood/banks", params={"blood_group": group})).status_code == 422


async def test_banks_are_nearest_first_with_a_location_and_by_name_without(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    await add_listing(session, "Zeta Bank", category_slug="blood-bank", latitude=6.4510, longitude=7.5090)
    await add_listing(session, "Alpha Bank", category_slug="blood-bank", latitude=6.60, longitude=7.70)
    await session.commit()
    assert names(await banks(client, lat=MY_LATITUDE, lng=MY_LONGITUDE)) == ["Zeta Bank", "Alpha Bank"]
    assert names(await banks(client)) == ["Alpha Bank", "Zeta Bank"]
    assert (await banks(client, lat=MY_LATITUDE, lng=MY_LONGITUDE))["items"][1][
        "distance_km"
    ] > 10  # no distance limit


@pytest.mark.parametrize("status", [s for s in ListingStatus if s is not ListingStatus.published])
async def test_a_listing_that_is_not_published_is_never_returned(
    client: AsyncClient, session: AsyncSession, clock: None, status: ListingStatus
) -> None:
    await add_listing(
        session,
        "Hidden Bank",
        category_slug="blood-bank",
        services=groups("O+", "Blood donation"),
        status=status,
    )
    await session.commit()
    assert (await banks(client))["total"] == 0
    assert (await centres(client))["total"] == 0


async def test_a_listing_reported_not_working_by_two_people_is_left_out(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    flagged = await add_listing(
        session, "Flagged Bank", category_slug="blood-bank", services=groups("O+", "Blood donation")
    )
    await add_listing(
        session, "Fine Bank", category_slug="blood-bank", services=groups("O+", "Blood donation")
    )
    for key in ("one", "two"):
        await add_report(session, flagged, key, created_at=NOW - timedelta(days=1))
    await session.commit()
    assert names(await banks(client)) == ["Fine Bank"]
    assert names(await centres(client)) == ["Fine Bank"]


async def test_an_overdue_bank_stays_with_verification_due_and_nothing_is_sponsored(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    await add_listing(
        session,
        "Old Bank",
        category_slug="blood-bank",
        services=groups("O+"),
        next_check_due=NOW - timedelta(days=3),
        featured_until=NOW + timedelta(days=10),
    )
    await session.commit()
    item = (await banks(client))["items"][0]
    assert item["verification_due"] is True
    assert item["sponsored"] is False  # FR-19: a featured listing is not sponsored here


async def test_paging_and_the_total(client: AsyncClient, session: AsyncSession, clock: None) -> None:
    for number in range(5):
        await add_listing(session, f"Bank {number}", category_slug="blood-bank")
    await session.commit()
    first = await banks(client, limit=2, offset=0)
    second = await banks(client, limit=2, offset=2)
    assert first["total"] == second["total"] == 5
    assert names(first) + names(second) == ["Bank 0", "Bank 1", "Bank 2", "Bank 3"]
    for bad in ({"limit": 0}, {"limit": 101}, {"offset": -1}):
        assert (await client.get("/blood/banks", params=bad)).status_code == 422


@pytest.mark.parametrize(
    "params", [{"lat": 6.45}, {"lng": 7.5}, {"lat": 91, "lng": 7.5}, {"lat": 6.4, "lng": 181}]
)
async def test_a_half_or_impossible_location_is_422_on_both(
    client: AsyncClient, clock: None, params: dict
) -> None:
    assert (await client.get("/blood/banks", params=params)).status_code == 422
    assert (await client.get("/blood/donation-centres", params=params)).status_code == 422


async def test_the_number_of_queries_does_not_grow_with_the_number_of_banks(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    counter = {"statements": 0}

    def count(*_arguments: object) -> None:
        counter["statements"] += 1

    async def statements_for_both_requests() -> int:
        counter["statements"] = 0
        event.listen(session.bind.sync_engine, "before_cursor_execute", count)
        try:
            await banks(client)
            await centres(client)
        finally:
            event.remove(session.bind.sync_engine, "before_cursor_execute", count)
        return counter["statements"]

    await add_listing(session, "One", category_slug="blood-bank", services=groups("O+", "Blood donation"))
    await session.commit()
    few = await statements_for_both_requests()
    for number in range(8):
        await add_listing(
            session,
            f"More {number}",
            category_slug="blood-bank",
            services=groups("O+", "A+", "Blood donation"),
        )
    await session.commit()
    assert await statements_for_both_requests() == few


# --- donation centres ---


async def test_a_donation_centre_has_the_week_of_its_hours(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    hours = every_day(time(8, 0), time(17, 0))[:5]  # Monday to Friday
    await add_listing(
        session,
        "Donation Centre",
        category_slug="blood-bank",
        opening_hours=hours,
        services=[Service(listing_id=0, name="Blood donation")],
    )
    await session.commit()
    item = (await centres(client))["items"][0]
    assert len(item["donation_hours"]) == 7
    assert item["donation_hours"][0] == {
        "day_of_week": 0,
        "opens_at": "08:00",
        "closes_at": "17:00",
        "is_closed": False,
    }
    assert item["donation_hours"][5] == {
        "day_of_week": 5,
        "opens_at": None,
        "closes_at": None,
        "is_closed": True,
    }
    assert item["sponsored"] is False
    assert "blood_groups" not in item


async def test_only_listings_with_a_blood_donation_service_are_centres_in_any_spelling(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    await add_listing(
        session,
        "Centre A",
        category_slug="blood-bank",
        services=[Service(listing_id=0, name="Blood donation")],
    )
    await add_listing(
        session,
        "Centre B",
        category_slug="hospital",
        services=[Service(listing_id=0, name=" BLOOD  donation ")],
    )
    await add_listing(session, "Bank Only", category_slug="blood-bank", services=groups("O+"))
    await add_listing(session, "Clinic", category_slug="clinic", service_names=("Consultation",))
    await session.commit()
    assert names(await centres(client)) == ["Centre A", "Centre B"]


async def test_centres_are_nearest_first_with_a_location_and_by_name_without_and_paged(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    donation = [Service(listing_id=0, name="Blood donation")]
    await add_listing(session, "Zeta Centre", services=donation, latitude=6.4510, longitude=7.5090)
    await add_listing(
        session,
        "Alpha Centre",
        services=[Service(listing_id=0, name="Blood donation")],
        latitude=6.60,
        longitude=7.70,
    )
    await session.commit()
    assert names(await centres(client, lat=MY_LATITUDE, lng=MY_LONGITUDE)) == ["Zeta Centre", "Alpha Centre"]
    assert names(await centres(client)) == ["Alpha Centre", "Zeta Centre"]
    assert names(await centres(client, limit=1, offset=1)) == ["Zeta Centre"]
    assert (await centres(client, limit=1))["total"] == 2
