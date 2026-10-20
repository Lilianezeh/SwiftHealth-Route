"""Find blood and donate blood. Requirements: US-15, US-16, FR-27, FR-28, FR-08, FR-19, FR-22, NFR-07.
Decisions F1 to F5 in specs/2026-10-20-blood/requirements.md.

It reuses the rules of search_service (trust rules, distance, open now, the FR-22 exclusion) and
never marks anything as sponsored (FR-19). The groups of a listing are its services whose name is
one of the eight groups, matched by the same-service rule of GET /meta; the date confirmed is the
newest `fee_collected_at` among them (blood groups are stored as services, CLAUDE.md).
"""

from datetime import date, datetime

from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import BLOOD_GROUPS
from app.core.service_names import normalise_service_name
from app.models import Service
from app.repositories import blood_repository
from app.repositories.blood_repository import ListingWithServices
from app.schemas.blood import (
    BloodBankItem,
    BloodBankList,
    BloodBankParams,
    DonationCentreItem,
    DonationCentreList,
    PagedLocationParams,
)
from app.schemas.listing import ListingSummary
from app.services.hours import is_open_at
from app.services.listing_service import hours_of_the_week
from app.services.search_service import REPORT_WINDOW, REPORTS_TO_EXCLUDE, distance_in_km, to_summary

BLOOD_BANK_SERVICE = "Blood bank"
BLOOD_DONATION_SERVICE = "Blood donation"
BLOOD_BANK_CATEGORY = "blood-bank"
GROUP_BY_KEY = {normalise_service_name(group): group for group in BLOOD_GROUPS}


def groups_of(services: list[Service]) -> tuple[list[str], date | None]:
    """The blood groups among the services, in the fixed order, and the newest date they were confirmed."""
    found: set[str] = set()
    confirmed: date | None = None
    for service in services:
        group = GROUP_BY_KEY.get(normalise_service_name(service.name))
        if group is None:
            continue
        found.add(group)
        if service.fee_collected_at is not None and (
            confirmed is None or service.fee_collected_at > confirmed
        ):
            confirmed = service.fee_collected_at
    return [group for group in BLOOD_GROUPS if group in found], confirmed


def ordered_with_summaries(
    entries: list[ListingWithServices], params: PagedLocationParams, moment: datetime
) -> list[tuple[ListingWithServices, ListingSummary]]:
    """Nearest first with a location, otherwise by name; ties by name, then id. Nothing is sponsored."""
    ranked: list[tuple[ListingWithServices, float | None]] = []
    for entry in entries:
        listing = entry.candidate.listing
        distance = None
        if params.lat is not None and params.lng is not None:
            distance = distance_in_km(params.lat, params.lng, listing.latitude, listing.longitude)
        ranked.append((entry, distance))
    ranked.sort(
        key=lambda pair: (
            pair[1] if pair[1] is not None else 0,
            pair[0].candidate.listing.name,
            pair[0].candidate.listing.id,
        )
    )
    page = ranked[params.offset : params.offset + params.limit]
    result = []
    for entry, distance in page:
        listing = entry.candidate.listing
        is_open = is_open_at(entry.candidate.opening_hours, listing.is_24_hours, moment)
        result.append((entry, to_summary(entry.candidate, distance, is_open, moment)))
    return result


async def list_blood_banks(session: AsyncSession, params: BloodBankParams, moment: datetime) -> BloodBankList:
    """`moment` is passed in (never read from the clock here), so tests can choose the time."""
    entries = await blood_repository.find_listings(
        session,
        category_slug=BLOOD_BANK_CATEGORY,
        any_service_keys={normalise_service_name(BLOOD_BANK_SERVICE), *GROUP_BY_KEY},
        required_service_keys={normalise_service_name(params.blood_group)} if params.blood_group else None,
        reports_since=moment - REPORT_WINDOW,
        reports_to_exclude=REPORTS_TO_EXCLUDE,
    )
    page = ordered_with_summaries(entries, params, moment)
    items = []
    for entry, summary in page:
        blood_groups, confirmed_at = groups_of(entry.services)
        items.append(
            BloodBankItem(
                **summary.model_dump(), blood_groups=blood_groups, blood_groups_confirmed_at=confirmed_at
            )
        )
    return BloodBankList(items=items, total=len(entries))


async def list_donation_centres(
    session: AsyncSession, params: PagedLocationParams, moment: datetime
) -> DonationCentreList:
    entries = await blood_repository.find_listings(
        session,
        category_slug=None,
        any_service_keys={normalise_service_name(BLOOD_DONATION_SERVICE)},
        required_service_keys=None,
        reports_since=moment - REPORT_WINDOW,
        reports_to_exclude=REPORTS_TO_EXCLUDE,
    )
    page = ordered_with_summaries(entries, params, moment)
    items = [
        DonationCentreItem(
            **summary.model_dump(), donation_hours=hours_of_the_week(entry.candidate.opening_hours)
        )
        for entry, summary in page
    ]
    return DonationCentreList(items=items, total=len(entries))
