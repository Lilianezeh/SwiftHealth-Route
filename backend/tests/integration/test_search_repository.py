"""The SQL side of search: status, filters, the `q` match and the FR-22 exclusion.
Requirements: US-01, US-05, FR-04, FR-05, FR-08, FR-22.

The names below are invented from real Enugu place words ("Ogui", "Uwani", "Independence Layout"...).
They are not real facilities. Decisions 1, 2, 4 and 5 in specs/2026-10-09-search-backend/requirements.md.
"""
from datetime import datetime, timedelta, timezone

import pytest
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.base import ListingStatus, ReportReason, ReportStatus
from app.repositories import search_repository
from app.services.search_service import MATCH_THRESHOLD, REPORT_WINDOW, REPORTS_TO_EXCLUDE
from tests.factories import add_listing, add_report

pytestmark = pytest.mark.anyio

NOW = datetime(2026, 10, 6, 9, 0, tzinfo=timezone.utc)


async def find_names(session: AsyncSession, **filters: object) -> list[str]:
    """Runs the repository query with the service's real rules, and returns the listing names, sorted."""
    arguments: dict[str, object] = {
        "q": None, "category_slug": None, "service_name": None, "area": None, "is_24_hours": False,
        "reports_since": NOW - REPORT_WINDOW, "reports_to_exclude": REPORTS_TO_EXCLUDE,
        "match_threshold": MATCH_THRESHOLD,
    }
    arguments.update(filters)
    candidates = await search_repository.find_candidates(session, **arguments)  # type: ignore[arg-type]
    return sorted(candidate.listing.name for candidate in candidates)


async def test_draft_pending_review_hidden_and_recheck_due_are_never_returned(session: AsyncSession) -> None:
    await add_listing(session, "Published Pharmacy")
    for status in (
        ListingStatus.draft, ListingStatus.pending_review, ListingStatus.hidden, ListingStatus.recheck_due
    ):
        await add_listing(session, f"{status.value} pharmacy", status=status)
    await session.commit()
    assert await find_names(session) == ["Published Pharmacy"]


async def test_category_filter_uses_the_slug(session: AsyncSession) -> None:
    await add_listing(session, "Ogui Road Pharmacy", category_slug="pharmacy")
    await add_listing(session, "Ogui Road Clinic", category_slug="clinic")
    await session.commit()
    assert await find_names(session, category_slug="clinic") == ["Ogui Road Clinic"]
    assert await find_names(session, category_slug="no-such-category") == []


async def test_service_filter_finds_only_listings_that_offer_it(session: AsyncSession) -> None:
    await add_listing(session, "Scan Centre", category_slug="lab", service_names=("X-ray", "Ultrasound"))
    await add_listing(session, "Basic Clinic", category_slug="clinic", service_names=("Consultation",))
    await add_listing(session, "No Services Clinic", category_slug="clinic")
    await session.commit()
    assert await find_names(session, service_name="X-ray") == ["Scan Centre"]
    assert await find_names(session, service_name="x-RAY") == ["Scan Centre"]  # the case does not matter
    assert await find_names(session, service_name="MRI") == []


async def test_area_filter(session: AsyncSession) -> None:
    await add_listing(session, "Ogui Place", area="Ogui")
    await add_listing(session, "Uwani Place", area="Uwani")
    await session.commit()
    assert await find_names(session, area="Uwani") == ["Uwani Place"]


async def test_is_24_hours_filter_uses_the_flag(session: AsyncSession) -> None:
    await add_listing(session, "Day Pharmacy")
    await add_listing(session, "Night Pharmacy", is_24_hours=True)
    await session.commit()
    assert await find_names(session, is_24_hours=True) == ["Night Pharmacy"]
    assert await find_names(session, is_24_hours=False) == ["Day Pharmacy", "Night Pharmacy"]


# --- FR-04: q is tolerant of misspellings. The threshold is chosen with these examples (decision 2). ---

NAMED_PLACES = (  # (name, area, services)
    ("Ogui Road Pharmacy", "Ogui", ("Prescription filling",)),
    ("Independence Layout Clinic", "Independence Layout", ("Consultation", "Malaria test")),
    ("Uwani Maternity Home", "Uwani", ("Antenatal care", "Ultrasound")),
    ("Coal Camp Diagnostic Laboratory", "Coal Camp", ("Blood test", "X-ray")),
    ("GRA General Hospital", "GRA", ("Emergency care",)),
    ("Abakpa Medical Centre", "Abakpa Nike", ("Dental care",)),
    ("Trans Ekulu Eye Clinic", "Trans-Ekulu", ("Eye test",)),
)


async def add_named_places(session: AsyncSession) -> None:
    for name, area, services in NAMED_PLACES:
        await add_listing(session, name, area=area, service_names=services)
    await session.commit()


@pytest.mark.parametrize(
    "query, expected_name",
    [
        ("Ogui Road Pharmacy", "Ogui Road Pharmacy"),  # exact
        ("ogui road pharmacy", "Ogui Road Pharmacy"),  # the case does not matter
        ("pharmcy", "Ogui Road Pharmacy"),  # a missing letter
        ("Pharmacey", "Ogui Road Pharmacy"),  # an extra letter
        ("farmacy", "Ogui Road Pharmacy"),  # spelled the way it sounds
        ("hospitl", "GRA General Hospital"),
        ("clinik", "Independence Layout Clinic"),
        ("labouratory", "Coal Camp Diagnostic Laboratory"),
        ("Independance Layout Clinic", "Independence Layout Clinic"),  # a wrong vowel in the name
        ("Uwani Maternty", "Uwani Maternity Home"),
        ("diagnostic labratory", "Coal Camp Diagnostic Laboratory"),
        ("general hosptial", "GRA General Hospital"),  # two letters swapped
        ("Ogui", "Ogui Road Pharmacy"),  # a part of the name is enough
    ],
)
async def test_q_finds_a_misspelled_facility_name(
    session: AsyncSession, query: str, expected_name: str
) -> None:
    await add_named_places(session)
    assert expected_name in await find_names(session, q=query)


@pytest.mark.parametrize(
    "query, expected_name",
    [
        ("Abakpa Nike", "Abakpa Medical Centre"),  # an area, exact
        ("Abaka Nike", "Abakpa Medical Centre"),  # an area, a letter missing
        ("Independance Layout", "Independence Layout Clinic"),
        ("Coal Cmp", "Coal Camp Diagnostic Laboratory"),
        ("Trans-Ekulu", "Trans Ekulu Eye Clinic"),
        ("trans ekulu", "Trans Ekulu Eye Clinic"),  # a space for the hyphen
    ],
)
async def test_q_finds_a_misspelled_area(session: AsyncSession, query: str, expected_name: str) -> None:
    await add_named_places(session)
    assert expected_name in await find_names(session, q=query)


@pytest.mark.parametrize(
    "query, expected_name",
    [
        ("Ultrasound", "Uwani Maternity Home"),
        ("ultrasond", "Uwani Maternity Home"),
        ("malaria tst", "Independence Layout Clinic"),
        ("antenatl care", "Uwani Maternity Home"),
        ("dental", "Abakpa Medical Centre"),
        ("xray", "Coal Camp Diagnostic Laboratory"),  # no hyphen
        ("x-ray", "Coal Camp Diagnostic Laboratory"),
        ("eye tset", "Trans Ekulu Eye Clinic"),
    ],
)
async def test_q_finds_a_misspelled_service_name(
    session: AsyncSession, query: str, expected_name: str
) -> None:
    await add_named_places(session)
    assert expected_name in await find_names(session, q=query)


@pytest.mark.parametrize(
    "query",
    ["banana", "football", "zzzzzz", "kitchen", "airline ticket", "hotel", "lagos", "uniform", "market"],
)
async def test_q_with_an_unrelated_word_finds_nothing(session: AsyncSession, query: str) -> None:
    await add_named_places(session)
    assert await find_names(session, q=query) == []


async def test_a_misspelling_does_not_pull_in_a_different_place(session: AsyncSession) -> None:
    await add_named_places(session)
    assert await find_names(session, q="pharmcy") == ["Ogui Road Pharmacy"]
    assert await find_names(session, q="Uwani Maternty") == ["Uwani Maternity Home"]


async def test_q_matches_each_listing_once_even_when_two_services_match(session: AsyncSession) -> None:
    await add_listing(session, "Scan Centre", service_names=("Ultrasound scan", "Ultrasound doppler"))
    await session.commit()
    assert await find_names(session, q="ultrasound") == ["Scan Centre"]


async def test_q_filters_together_with_the_other_filters(session: AsyncSession) -> None:
    await add_listing(session, "Ogui Road Pharmacy", area="Ogui", category_slug="pharmacy")
    await add_listing(session, "Ogui Road Clinic", area="Ogui", category_slug="clinic")
    await session.commit()
    assert await find_names(session, q="Ogui", category_slug="clinic") == ["Ogui Road Clinic"]


@pytest.mark.parametrize("query", ["'; DROP TABLE listings; --", "100%", "under_score", "a" * 100, "\\"])
async def test_q_with_odd_characters_returns_normally(session: AsyncSession, query: str) -> None:
    await add_named_places(session)
    assert isinstance(await find_names(session, q=query), list)
    assert len(await find_names(session)) == len(NAMED_PLACES)  # the table is intact


# --- FR-22: 2 different reporters, "not working", in 7 days, hide a listing ---

REPORT_TIME = NOW - timedelta(days=1)


async def listing_with_reports(
    session: AsyncSession, *reports: tuple[str | None, datetime, ReportReason, ReportStatus]
) -> None:
    listing = await add_listing(session, "Reported Pharmacy")
    await add_listing(session, "Other Pharmacy")
    for reporter_key, created_at, reason, status in reports:
        await add_report(session, listing, reporter_key, created_at=created_at, reason=reason, status=status)
    await session.commit()


def report(
    key: str | None, created_at: datetime = REPORT_TIME,
    reason: ReportReason = ReportReason.not_working, status: ReportStatus = ReportStatus.open,
) -> tuple[str | None, datetime, ReportReason, ReportStatus]:
    return key, created_at, reason, status


async def test_two_not_working_reports_from_different_reporters_in_7_days_exclude_the_listing(
    session: AsyncSession,
) -> None:
    await listing_with_reports(session, report("key-a"), report("key-b"))
    assert await find_names(session) == ["Other Pharmacy"]


async def test_one_report_does_not_exclude_the_listing(session: AsyncSession) -> None:
    await listing_with_reports(session, report("key-a"))
    assert await find_names(session) == ["Other Pharmacy", "Reported Pharmacy"]


async def test_two_reports_with_the_same_reporter_key_count_as_one(session: AsyncSession) -> None:
    await listing_with_reports(session, report("key-a"), report("key-a"))
    assert await find_names(session) == ["Other Pharmacy", "Reported Pharmacy"]


async def test_three_reports_from_two_reporters_exclude_the_listing(session: AsyncSession) -> None:
    await listing_with_reports(session, report("key-a"), report("key-a"), report("key-b"))
    assert await find_names(session) == ["Other Pharmacy"]


async def test_reports_older_than_7_days_do_not_count(session: AsyncSession) -> None:
    just_inside = NOW - timedelta(days=6, hours=23)
    just_outside = NOW - timedelta(days=7, hours=1)
    await listing_with_reports(session, report("key-a", just_inside), report("key-b", just_outside))
    assert await find_names(session) == ["Other Pharmacy", "Reported Pharmacy"]  # only one is inside


async def test_two_reports_both_just_inside_7_days_exclude_the_listing(session: AsyncSession) -> None:
    just_inside = NOW - timedelta(days=6, hours=23)
    await listing_with_reports(session, report("key-a", just_inside), report("key-b", just_inside))
    assert await find_names(session) == ["Other Pharmacy"]


@pytest.mark.parametrize(
    "reason",
    [ReportReason.wrong_number, ReportReason.closed, ReportReason.moved, ReportReason.wrong_hours,
     ReportReason.other],
)
async def test_other_report_reasons_do_not_count(session: AsyncSession, reason: ReportReason) -> None:
    await listing_with_reports(session, report("key-a", reason=reason), report("key-b", reason=reason))
    assert await find_names(session) == ["Other Pharmacy", "Reported Pharmacy"]


@pytest.mark.parametrize("status", [ReportStatus.resolved, ReportStatus.dismissed])
async def test_resolved_and_dismissed_reports_do_not_count(
    session: AsyncSession, status: ReportStatus
) -> None:
    await listing_with_reports(session, report("key-a", status=status), report("key-b", status=status))
    assert await find_names(session) == ["Other Pharmacy", "Reported Pharmacy"]


async def test_reports_without_a_reporter_key_never_exclude_a_listing(session: AsyncSession) -> None:
    await listing_with_reports(session, report(None), report(None), report(None))
    assert await find_names(session) == ["Other Pharmacy", "Reported Pharmacy"]


async def test_reports_for_one_listing_do_not_hide_another(session: AsyncSession) -> None:
    await listing_with_reports(session, report("key-a"), report("key-b"))
    assert "Other Pharmacy" in await find_names(session)
