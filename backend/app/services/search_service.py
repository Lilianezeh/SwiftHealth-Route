"""Open now, nearest first. The hard part.
Requirements: US-01, US-05, FR-04 to FR-06, FR-08, FR-22, NFR-02, NFR-08.

Reference logic: spikes/open_now_nearest.py. One rule differs from the spike: an overdue listing is labelled
`verification_due` and stays visible (FR-08); only the nightly job (phase 11b) hides it.
Decisions 3, 7, 8, 11 and 12 in specs/2026-10-09-search-backend/requirements.md.
"""
from datetime import datetime, timedelta
from math import asin, cos, radians, sin, sqrt

from sqlmodel.ext.asyncio.session import AsyncSession

from app.repositories import listing_repository, search_repository
from app.repositories.search_repository import SearchCandidate
from app.schemas.listing import CategorySummary, ListingSummary, MainFacilityRef
from app.schemas.search import SearchParams, SearchResponse
from app.services.hours import hours_note, is_open_at
from app.services.verification import is_verification_due

REPORT_WINDOW = timedelta(days=7)  # FR-22
REPORTS_TO_EXCLUDE = 2  # FR-22: different reporters saying "not working"
MATCH_THRESHOLD = 0.55  # pg_trgm word_similarity from 0 to 1, chosen with the examples in the requirements
EARTH_RADIUS_KM = 6371
# The word rule (below) is used for 2 to 6 distinct words. A longer query uses only the whole-query rule.
MAX_QUERY_WORDS = 6


def split_query_words(query: str | None) -> list[str]:
    """The words for the word rule: lower case, each word once, in the order typed.

    The whole-query match scores two typos in two short words too low ("Nigt Pharmcy" is 0.50), so a listing
    also matches when every word matches on its own (requirements, decision 2). A single word needs no word
    rule, and a very long query is left to the whole-query rule so the SQL stays small.
    """
    words = list(dict.fromkeys((query or "").lower().split()))
    return words if 2 <= len(words) <= MAX_QUERY_WORDS else []


def distance_in_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Straight-line distance between two map points (haversine formula)."""
    lat_change, lng_change = radians(lat2 - lat1), radians(lng2 - lng1)
    haversine = sin(lat_change / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(lng_change / 2) ** 2
    return EARTH_RADIUS_KM * 2 * asin(sqrt(haversine))


def to_summary(
    candidate: SearchCandidate,
    distance: float | None,
    is_open_now: bool,
    moment: datetime,
    sponsored: bool = False,
) -> ListingSummary:
    """Only `search_listings` passes `sponsored=True`: no other list is ever sponsored (FR-19)."""
    listing = candidate.listing
    return ListingSummary(
        id=listing.id,
        slug=listing.slug,
        name=listing.name,
        category=CategorySummary(slug=candidate.category.slug, name=candidate.category.name),
        area=listing.area,
        address=listing.address,
        latitude=listing.latitude,
        longitude=listing.longitude,
        distance_km=None if distance is None else round(distance, 1),
        is_open_now=is_open_now,
        is_24_hours=listing.is_24_hours,
        primary_phone=candidate.primary_phone,
        last_verified_at=listing.last_verified_at,
        verification_due=is_verification_due(listing.next_check_due, moment),
        sponsored=sponsored,
        # Worked out here, after paging, so only the 20 results at most that are returned pay for it.
        hours_note=hours_note(candidate.opening_hours, listing.is_24_hours, moment),
    )


async def search_listings(session: AsyncSession, params: SearchParams, moment: datetime) -> SearchResponse:
    """`moment` is passed in (never read from the clock here), so tests can choose the time."""
    candidates = await search_repository.find_candidates(
        session,
        search_text=params.search_text,
        search_words=split_query_words(params.search_text),
        category_slug=params.category,
        service_name=params.service,
        area=params.area,
        is_24_hours=params.is_24_hours,
        reports_since=moment - REPORT_WINDOW,
        reports_to_exclude=REPORTS_TO_EXCLUDE,
        match_threshold=MATCH_THRESHOLD,
    )

    results: list[tuple[SearchCandidate, float | None, bool]] = []
    for candidate in candidates:
        listing = candidate.listing
        distance = None
        if params.lat is not None and params.lng is not None:
            distance = distance_in_km(params.lat, params.lng, listing.latitude, listing.longitude)
            if distance > params.radius_km:
                continue
        is_open_now = is_open_at(candidate.opening_hours, listing.is_24_hours, moment)
        if params.open_now and not is_open_now:
            continue
        results.append((candidate, distance, is_open_now))

    # Nearest first when we know where the caller is, otherwise by name. Ties are broken by name, then id.
    results.sort(key=lambda result: (
        result[1] if result[1] is not None else 0, result[0].listing.name, result[0].listing.id
    ))
    # The sponsored slot (FR-45): one featured listing goes first. It is taken out of its normal place,
    # so it is not repeated lower down, and the total does not change. Paging then works on the whole list.
    sponsored_id = None
    sponsored_result = first_sponsorable(results, moment)
    if sponsored_result is not None:
        sponsored_id = sponsored_result[0].listing.id
        results.remove(sponsored_result)
        results.insert(0, sponsored_result)
    page = results[params.offset:params.offset + params.limit]
    items = [
        to_summary(candidate, distance, is_open, moment, sponsored=candidate.listing.id == sponsored_id)
        for candidate, distance, is_open in page
    ]
    # "Branch of {name}" (FR-52), for the page of results only, and only while the main facility is published.
    parent_ids = {
        candidate.listing.parent_id for candidate, _distance, _open in page
        if candidate.listing.parent_id is not None
    }
    main_facilities = await listing_repository.published_main_facilities(session, parent_ids)
    for item, (candidate, _distance, _open) in zip(items, page, strict=True):
        parent_id = candidate.listing.parent_id
        if parent_id is not None and parent_id in main_facilities:
            name, slug = main_facilities[parent_id]
            item.branch_of = MainFacilityRef(name=name, slug=slug)
    return SearchResponse(items=items, total=len(results))


def first_sponsorable(
    results: list[tuple[SearchCandidate, float | None, bool]], moment: datetime
) -> tuple[SearchCandidate, float | None, bool] | None:
    """The first result, in the normal order, that may take the sponsored slot, or None (decision I11).

    It needs a featured period that has not ended (`featured_until` after `moment`) and a category that
    is not an emergency one: SwiftRescue never shows sponsored placement (FR-19). The results here already
    match every filter and the radius, and are published and not flagged.
    """
    for result in results:
        candidate = result[0]
        featured_until = candidate.listing.featured_until
        if featured_until is not None and featured_until > moment and not candidate.category.is_emergency:
            return result
    return None
