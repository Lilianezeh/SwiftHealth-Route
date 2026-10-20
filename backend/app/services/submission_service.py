"""A facility owner sends the "List your facility" form. Requirements: FR-37, FR-38, NFR-07.
Decisions C5 to C7 in specs/2026-10-20-staff-screens/requirements.md.

The form becomes a draft with no creator. The contact details are NOT put in the listing (its
description is public once published, and they are personal data): they go in an audit entry that
only staff can read. The map pin is the default centre until a verifier sets the real one.
"""

from datetime import datetime

from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import DEFAULT_MAP_CENTRE
from app.models import Listing, PhoneNumber
from app.models.base import ListingStatus
from app.repositories import audit_repository, category_repository, listing_repository
from app.schemas.submission import SubmissionCreate
from app.services.staff_listing_service import SUBMISSION_ACTION, unique_slug

THANKS = "Thanks. Our team will verify your facility before it is listed."


class SubmissionCategoryError(Exception):
    """The category does not exist or is an emergency category (staff add those). The route answers 422."""


def contact_text(payload: SubmissionCreate) -> str:
    text = f"Contact: {payload.contact_name}, {payload.contact_email}."
    return f"{text} Notes: {payload.notes}" if payload.notes else text


async def create_submission(session: AsyncSession, payload: SubmissionCreate, moment: datetime) -> None:
    category = await category_repository.get_by_slug(session, payload.category)
    if category is None or category.is_emergency:
        raise SubmissionCategoryError(payload.category)
    listing = Listing(
        slug=await unique_slug(session, payload.facility_name, payload.area),
        name=payload.facility_name,
        category_id=category.id,
        area=payload.area,
        address=payload.address,
        latitude=DEFAULT_MAP_CENTRE[0],
        longitude=DEFAULT_MAP_CENTRE[1],
        status=ListingStatus.draft,
        created_by=None,
        created_at=moment,
        updated_at=moment,
    )
    phone = PhoneNumber(listing_id=0, number=payload.phone, is_primary=True)
    await listing_repository.add_listing_with_details(session, listing, [phone], [], [])
    await audit_repository.add_entry(
        session,
        user_id=None,
        listing_id=listing.id,
        action="create",
        reference="facility-submission",
        changed_at=moment,
    )
    await audit_repository.add_entry(
        session,
        user_id=None,
        listing_id=listing.id,
        action=SUBMISSION_ACTION,
        field_changed="contact",
        new_value=contact_text(payload),
        changed_at=moment,
    )
    await session.commit()
