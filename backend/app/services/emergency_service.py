"""SwiftRescue: the national line and the emergency contacts in groups.
Requirements: FR-14 to FR-19, FR-26. (FR-25, the 24-hour pharmacies, was removed on 2026-10-22: decision K6
in specs/2026-10-22-swiftrescue-order/. Pharmacies are found with /search.)

It reuses the rules of search_service (trust rules, distance, open now, the FR-22 exclusion) and never
marks anything as sponsored (FR-19). Decisions A1 to A4 in specs/2026-10-17-swiftrescue/requirements.md.
"""
from datetime import datetime

from sqlmodel.ext.asyncio.session import AsyncSession

from app.repositories import search_repository
from app.repositories.search_repository import SearchCandidate
from app.schemas.emergency import EmergencyGroup, EmergencyResponse, NationalLine
from app.schemas.listing import CategorySummary, ListingSummary
from app.schemas.location import LocationParams
from app.services.hours import is_open_at
from app.services.search_service import (
    MATCH_THRESHOLD,
    REPORT_WINDOW,
    REPORTS_TO_EXCLUDE,
    distance_in_km,
    to_summary,
)

# FR-14: a constant, not a database row, so 112 is there even with an empty database.
NATIONAL_LINE = NationalLine(name="National emergency number", number="112")
DISCLAIMER = (
    "SwiftRescue connects you to emergency contacts; it does not dispatch or guarantee an emergency "
    "response. In danger, call 112."
)  # FR-26
# FR-15: the groups and their order. The names are the headings of the page, kept here so they do not
# depend on the names of the category rows.
GROUPS: tuple[tuple[str, str], ...] = (
    ("ambulance", "Ambulance"),
    ("fire", "Fire"),
    ("police", "Police"),
    ("emergency-unit", "24-hour emergency units"),
    ("roadside-assistance", "Roadside assistance"),
    ("security", "Security"),
    ("blood-bank", "Blood banks"),
)


def summaries_in_order(
    candidates: list[SearchCandidate], location: LocationParams, moment: datetime
) -> list[ListingSummary]:
    """Nearest first with a location, otherwise by name; ties by name, then id. Nothing is sponsored."""
    ranked: list[tuple[SearchCandidate, float | None]] = []
    for candidate in candidates:
        listing = candidate.listing
        distance = None
        if location.lat is not None and location.lng is not None:
            distance = distance_in_km(location.lat, location.lng, listing.latitude, listing.longitude)
        ranked.append((candidate, distance))
    ranked.sort(
        key=lambda entry: (
            entry[1] if entry[1] is not None else 0, entry[0].listing.name, entry[0].listing.id
        )
    )
    summaries = []
    for candidate, distance in ranked:
        listing = candidate.listing
        is_open = is_open_at(candidate.opening_hours, listing.is_24_hours, moment)
        summaries.append(to_summary(candidate, distance, is_open, moment))
    return summaries


async def get_emergency(
    session: AsyncSession, location: LocationParams, moment: datetime
) -> EmergencyResponse:
    """`moment` is passed in (never read from the clock here), so tests can choose the time."""
    # The same inputs as /search with no text, no service and no area.
    shared_filters = {
        "search_text": None,
        "search_words": [],
        "service_name": None,
        "area": None,
        "reports_since": moment - REPORT_WINDOW,
        "reports_to_exclude": REPORTS_TO_EXCLUDE,
        "match_threshold": MATCH_THRESHOLD,
    }
    contacts = await search_repository.find_candidates(
        session,
        category_slug=None,
        category_slugs=[slug for slug, _ in GROUPS],
        is_24_hours=False,
        **shared_filters,
    )

    groups = [
        EmergencyGroup(
            category=CategorySummary(slug=slug, name=name),
            contacts=summaries_in_order(
                [candidate for candidate in contacts if candidate.category.slug == slug], location, moment
            ),
        )
        for slug, name in GROUPS
    ]
    return EmergencyResponse(
        national_line=NATIONAL_LINE,
        groups=groups,
        disclaimer=DISCLAIMER,
    )
