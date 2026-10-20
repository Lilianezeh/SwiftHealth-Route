"""What staff see and change of listings. Requirements: FR-31, FR-38, FR-42, NFR-06.
Decisions C1 to C6 in specs/2026-10-20-staff-screens/requirements.md.

Reading: the staff list and the staff detail of any status. Writing (create and edit) is below. No HTTP
here: the routes turn the domain errors into status codes. Who may edit which listing is `access_service`.
"""

from datetime import datetime, timedelta

from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import DEFAULT_MAP_CENTRE
from app.models import User
from app.repositories import audit_repository, listing_repository, search_repository
from app.schemas.staff_listing import (
    DueFilter,
    StaffListingDetail,
    StaffListingList,
    StaffListingSummary,
    StaffListParams,
)
from app.services import listing_service
from app.services.hours import is_open_at
from app.services.search_service import REPORT_WINDOW, REPORTS_TO_EXCLUDE, to_summary

SUBMISSION_ACTION = (
    "submission"  # the audit entry that holds a "List your facility" form's contact details (C6)
)
THIS_WEEK = timedelta(days=7)


class ListingNotFoundError(Exception):
    """No listing has this id."""


def is_default_pin(latitude: float, longitude: float) -> bool:
    return (latitude, longitude) == DEFAULT_MAP_CENTRE


async def list_listings(
    session: AsyncSession, user: User, params: StaffListParams, moment: datetime
) -> StaffListingList:
    """One page of listings of every status. `moment` is passed in (never read from the clock here)."""
    due_before = due_after = None
    if params.due == DueFilter.overdue:
        due_before = moment
    elif params.due == DueFilter.this_week:
        due_after, due_before = moment, moment + THIS_WEEK
    rows, total = await listing_repository.list_for_staff(
        session,
        status=params.status,
        category_slug=params.category,
        area=params.area,
        name_contains=params.search_text,
        due_after=due_after,
        due_before=due_before,
        created_by=user.id if params.mine else None,
        limit=params.limit,
        offset=params.offset,
    )
    items = []
    for candidate in await search_repository.candidates_from_rows(session, rows):
        listing = candidate.listing
        is_open = is_open_at(candidate.opening_hours, listing.is_24_hours, moment)
        summary = to_summary(candidate, None, is_open, moment)
        items.append(
            StaffListingSummary(
                **summary.model_dump(),
                status=listing.status,
                next_check_due=listing.next_check_due,
                created_by=listing.created_by,
            )
        )
    return StaffListingList(items=items, total=total)


async def get_staff_detail(session: AsyncSession, listing_id: int, moment: datetime) -> StaffListingDetail:
    """The detail of a listing of any status, with the fields only staff see."""
    rows = await listing_repository.get_detail_by_id(session, listing_id)
    if rows is None:
        raise ListingNotFoundError(listing_id)
    listing = rows.listing
    recently_reported = await listing_repository.is_reported_not_working(
        session, listing.id, reports_since=moment - REPORT_WINDOW, reports_to_flag=REPORTS_TO_EXCLUDE
    )
    public = listing_service.to_detail(rows, recently_reported=recently_reported, moment=moment)
    return StaffListingDetail(
        **public.model_dump(),
        status=listing.status,
        next_check_due=listing.next_check_due,
        owner_id=listing.owner_id,
        created_by=listing.created_by,
        featured_until=listing.featured_until,
        map_pin_is_default=is_default_pin(listing.latitude, listing.longitude),
        submission_details=await audit_repository.latest_new_value(session, listing.id, SUBMISSION_ACTION),
    )
