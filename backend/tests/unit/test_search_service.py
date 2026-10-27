"""The search service: open now, nearest first, the label and the paging.
Requirements: US-01, FR-05, FR-06, FR-08, NFR-08.

The first three tests are the spike's three checks (spikes/open_now_nearest.py), the CLAUDE.md "hard part".
One rule changed: the spike hides an overdue listing, the real search labels it `verification_due` and
keeps it (FR-08). Decisions 3, 7, 8, 11 and 12 in specs/2026-10-09-search-backend/requirements.md.
"""
from datetime import datetime, time, timedelta, timezone

import pytest
from sqlmodel.ext.asyncio.session import AsyncSession

from app.schemas.search import SearchParams
from app.services.hours import LAGOS_TIME
from app.services.search_service import MAX_QUERY_WORDS, distance_in_km, search_listings, split_query_words
from tests.factories import add_listing, every_day

pytestmark = pytest.mark.anyio

MY_LATITUDE, MY_LONGITUDE = 6.4500, 7.5080  # the spike's visitor
NOW_IN_UTC = datetime(2026, 10, 6, 9, 0, tzinfo=timezone.utc)


def tuesday_in_lagos(hour: int, minute: int = 0) -> datetime:
    return datetime(2026, 10, 6, hour, minute, tzinfo=LAGOS_TIME)  # a Tuesday, as in the spike


def near_me() -> SearchParams:
    return SearchParams(lat=MY_LATITUDE, lng=MY_LONGITUDE, open_now=True)


async def add_spike_places(session: AsyncSession) -> None:
    """The spike's demo places (fictional): a night pharmacy, a day pharmacy and a 24-hour clinic."""
    await add_listing(session, "Night Pharmacy A", latitude=6.4520, longitude=7.5100,
                      opening_hours=every_day(time(20, 0), time(2, 0)))
    await add_listing(session, "Day Pharmacy B", latitude=6.4400, longitude=7.4950,
                      opening_hours=every_day(time(8, 0), time(21, 0)))
    await add_listing(session, "24h Clinic C", category_slug="clinic", latitude=6.4700, longitude=7.5300,
                      is_24_hours=True, opening_hours=every_day(time(0, 0), time(23, 59)))
    await session.commit()


async def names_open_at(session: AsyncSession, hour: int, minute: int) -> list[str]:
    response = await search_listings(session, near_me(), tuesday_in_lagos(hour, minute))
    return [item.name for item in response.items]


async def test_late_shift_is_still_open_at_0130(session: AsyncSession) -> None:
    await add_spike_places(session)
    assert await names_open_at(session, 1, 30) == ["Night Pharmacy A", "24h Clinic C"]


async def test_late_shift_is_closed_at_0300(session: AsyncSession) -> None:
    await add_spike_places(session)
    assert await names_open_at(session, 3, 0) == ["24h Clinic C"]


async def test_nearest_open_place_comes_first(session: AsyncSession) -> None:
    await add_spike_places(session)
    assert await names_open_at(session, 10, 0) == ["Day Pharmacy B", "24h Clinic C"]


async def test_overdue_listing_is_returned_with_verification_due(session: AsyncSession) -> None:
    moment = tuesday_in_lagos(10)
    await add_listing(
        session, "Overdue Clinic", category_slug="clinic", is_24_hours=True,
        last_verified_at=moment - timedelta(days=60), next_check_due=moment - timedelta(days=15),
    )
    await session.commit()
    response = await search_listings(session, SearchParams(), moment)
    assert [item.name for item in response.items] == ["Overdue Clinic"]
    assert response.items[0].verification_due is True


async def test_listing_within_its_check_cycle_has_verification_due_false(session: AsyncSession) -> None:
    moment = tuesday_in_lagos(10)
    await add_listing(session, "Fresh Clinic", last_verified_at=moment - timedelta(days=3),
                      next_check_due=moment + timedelta(days=42))
    await session.commit()
    response = await search_listings(session, SearchParams(), moment)
    assert response.items[0].verification_due is False
    assert response.items[0].last_verified_at == moment - timedelta(days=3)


async def test_listing_without_next_check_due_is_not_overdue(session: AsyncSession) -> None:
    await add_listing(session, "Unscheduled Clinic")
    await session.commit()
    response = await search_listings(session, SearchParams(), tuesday_in_lagos(10))
    assert response.items[0].verification_due is False


async def test_distance_is_rounded_to_one_decimal_but_sorted_unrounded(session: AsyncSession) -> None:
    # Two places about 0.01 km apart round to the same 1-decimal distance but must keep their true order.
    await add_listing(session, "Farther Place", latitude=6.4540, longitude=7.5080)
    await add_listing(session, "Nearer Place", latitude=6.4539, longitude=7.5080)
    await session.commit()
    params = SearchParams(lat=MY_LATITUDE, lng=MY_LONGITUDE)
    response = await search_listings(session, params, tuesday_in_lagos(10))
    assert [item.name for item in response.items] == ["Nearer Place", "Farther Place"]
    assert response.items[0].distance_km == response.items[1].distance_km == 0.4
    assert isinstance(response.items[0].distance_km, float)


@pytest.mark.parametrize(
    "query, words",
    [
        (None, []),
        ("", []),
        ("pharmacy", []),  # one word: the whole-query rule already covers it
        ("Nigt Pharmcy", ["nigt", "pharmcy"]),  # lower case
        ("  Nigt   Pharmcy  ", ["nigt", "pharmcy"]),  # extra spaces
        ("pharmacy PHARMACY ogui", ["pharmacy", "ogui"]),  # the same word twice counts once
        ("a b c d e f", ["a", "b", "c", "d", "e", "f"]),  # exactly the most
        ("a b c d e f g", []),  # one more: the word rule is skipped
    ],
)
def test_split_query_words(query: str | None, words: list[str]) -> None:
    assert MAX_QUERY_WORDS == 6
    assert split_query_words(query) == words


def test_the_q_parameter_is_read_into_search_text() -> None:
    assert SearchParams(q="  Nigt Pharmcy ").search_text == "Nigt Pharmcy"  # trimmed
    assert SearchParams(q="   ").search_text is None  # blank means not given
    assert SearchParams().search_text is None


def test_distance_in_km_known_pair_and_same_point() -> None:
    assert distance_in_km(6.45, 7.5, 6.45, 7.5) == 0
    # One degree of latitude is about 111.2 km (Earth radius 6371 km).
    assert distance_in_km(6.0, 7.5, 7.0, 7.5) == pytest.approx(111.19, abs=0.1)
    assert distance_in_km(6.45, 7.5, 6.5, 7.6) == distance_in_km(6.5, 7.6, 6.45, 7.5)


async def test_two_typos_in_a_two_word_query_still_find_the_listing(session: AsyncSession) -> None:
    await add_listing(session, "Night Pharmacy", area="New Haven")
    await add_listing(session, "Day Clinic", area="GRA", category_slug="clinic")
    await session.commit()
    for query in ("Nigt Pharmcy", "nigt pharmcy", "Pharmcy Nigt"):
        response = await search_listings(session, SearchParams(q=query), tuesday_in_lagos(10))
        assert [item.name for item in response.items] == ["Night Pharmacy"], query
    unrelated = await search_listings(session, SearchParams(q="airline ticket"), tuesday_in_lagos(10))
    assert unrelated.total == 0


async def test_without_location_distance_is_null_and_results_sort_by_name(session: AsyncSession) -> None:
    await add_listing(session, "Zeta Pharmacy", latitude=6.4501, longitude=7.5081)
    await add_listing(session, "Alpha Pharmacy", latitude=6.60, longitude=7.80)
    await add_listing(session, "Mid Pharmacy", latitude=6.46, longitude=7.51)
    await session.commit()
    response = await search_listings(session, SearchParams(), tuesday_in_lagos(10))
    assert [item.name for item in response.items] == ["Alpha Pharmacy", "Mid Pharmacy", "Zeta Pharmacy"]
    assert [item.distance_km for item in response.items] == [None, None, None]


async def test_radius_excludes_listings_farther_away(session: AsyncSession) -> None:
    await add_listing(session, "Close Pharmacy", latitude=6.4510, longitude=7.5080)  # about 0.1 km
    await add_listing(session, "Far Pharmacy", latitude=6.5500, longitude=7.5080)  # about 11 km
    await session.commit()
    inside_default = SearchParams(lat=MY_LATITUDE, lng=MY_LONGITUDE)  # radius_km defaults to 10
    wide = SearchParams(lat=MY_LATITUDE, lng=MY_LONGITUDE, radius_km=50)
    default_radius_results = await search_listings(session, inside_default, tuesday_in_lagos(10))
    wide_radius_results = await search_listings(session, wide, tuesday_in_lagos(10))
    assert [listing.name for listing in default_radius_results.items] == ["Close Pharmacy"]
    assert [listing.name for listing in wide_radius_results.items] == ["Close Pharmacy", "Far Pharmacy"]


async def test_radius_ignored_without_location(session: AsyncSession) -> None:
    await add_listing(session, "Far Pharmacy", latitude=9.0, longitude=9.0)
    await session.commit()
    response = await search_listings(session, SearchParams(radius_km=1), tuesday_in_lagos(10))
    assert [item.name for item in response.items] == ["Far Pharmacy"]


async def test_open_now_filter_keeps_only_open_listings(session: AsyncSession) -> None:
    await add_spike_places(session)
    everything = await search_listings(session, SearchParams(), tuesday_in_lagos(3))
    only_open = await search_listings(session, SearchParams(open_now=True), tuesday_in_lagos(3))
    assert len(everything.items) == 3
    assert [item.name for item in only_open.items] == ["24h Clinic C"]
    assert only_open.total == 1


async def test_open_24_hours_filter_uses_only_the_flag(session: AsyncSession) -> None:
    # Hours that cover the whole day are not enough: only the confirmed flag counts.
    await add_listing(session, "Long Hours Pharmacy", opening_hours=every_day(time(0, 0), time(23, 59)))
    await add_listing(session, "Round The Clock Pharmacy", is_24_hours=True)
    await session.commit()
    response = await search_listings(session, SearchParams(is_24_hours=True), tuesday_in_lagos(10))
    assert [item.name for item in response.items] == ["Round The Clock Pharmacy"]


async def test_is_open_now_is_filled_on_every_result(session: AsyncSession) -> None:
    await add_spike_places(session)
    response = await search_listings(session, SearchParams(), tuesday_in_lagos(3))
    open_now_by_name = {item.name: item.is_open_now for item in response.items}
    assert open_now_by_name == {"Night Pharmacy A": False, "Day Pharmacy B": False, "24h Clinic C": True}


async def test_open_now_follows_lagos_time_when_the_server_clock_is_utc(session: AsyncSession) -> None:
    await add_listing(session, "Tuesday Early Pharmacy", opening_hours=[
        row for row in every_day(time(0, 0), time(6, 0)) if row.day_of_week == 1
    ])
    await session.commit()
    monday_2330_utc = datetime(2026, 10, 5, 23, 30, tzinfo=timezone.utc)  # 00:30 on Tuesday in Lagos
    response = await search_listings(session, SearchParams(open_now=True), monday_2330_utc)
    assert [item.name for item in response.items] == ["Tuesday Early Pharmacy"]


async def test_paging_total_counts_all_matches_before_limit_and_offset(session: AsyncSession) -> None:
    for name in ("A Pharmacy", "B Pharmacy", "C Pharmacy", "D Pharmacy", "E Pharmacy"):
        await add_listing(session, name)
    await session.commit()
    response = await search_listings(session, SearchParams(limit=2, offset=1), tuesday_in_lagos(10))
    assert [item.name for item in response.items] == ["B Pharmacy", "C Pharmacy"]
    assert response.total == 5
    past_the_end = await search_listings(session, SearchParams(limit=2, offset=10), tuesday_in_lagos(10))
    assert past_the_end.items == []
    assert past_the_end.total == 5


async def test_a_featured_listing_takes_the_one_sponsored_slot_and_goes_first(session: AsyncSession) -> None:
    # FR-45, phase 12. The full rules are tested through HTTP in test_search_sponsored.py.
    # verified 2 days ago: a featured listing takes the slot only when verified (api-spec 8, Sponsored rules)
    await add_listing(
        session, "Zulu Pharmacy", featured_until=NOW_IN_UTC + timedelta(days=10),
        last_verified_at=NOW_IN_UTC - timedelta(days=2),
    )
    await add_listing(session, "Alpha Pharmacy")
    await session.commit()
    response = await search_listings(session, SearchParams(), NOW_IN_UTC)
    assert [item.name for item in response.items] == ["Zulu Pharmacy", "Alpha Pharmacy"]
    assert [item.sponsored for item in response.items] == [True, False]
    assert response.total == 2


async def test_primary_phone_is_the_primary_number_in_plus234_format(session: AsyncSession) -> None:
    await add_listing(session, "Phone Pharmacy", phone="+2340000000042")
    await add_listing(session, "No Phone Pharmacy", phone=None)
    await session.commit()
    response = await search_listings(session, SearchParams(), tuesday_in_lagos(10))
    phones = {item.name: item.primary_phone for item in response.items}
    assert phones == {"Phone Pharmacy": "+2340000000042", "No Phone Pharmacy": None}


async def test_the_summary_has_only_the_fields_in_the_api_spec(session: AsyncSession) -> None:
    await add_listing(session, "Shape Pharmacy", area="Ogui")
    await session.commit()
    response = await search_listings(session, SearchParams(), tuesday_in_lagos(10))
    assert set(response.items[0].model_dump()) == {
        "id", "slug", "name", "category", "area", "address", "latitude", "longitude", "distance_km",
        "is_open_now", "is_24_hours", "primary_phone", "last_verified_at", "verification_due", "sponsored",
        "hours_note", "branch_of",  # branch_of: accounts phase 8b, null for every main facility
    }
    assert response.items[0].category.model_dump() == {"slug": "pharmacy", "name": "Pharmacy"}
