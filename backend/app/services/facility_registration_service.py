"""A provider registers a new facility or claims an existing one. Requirements: FR-50, FR-51, US-17, NFR-07.
Spec: specs/backend/api-spec.md section 7, "Phase 7"; decisions D14 and D15 of
specs/2026-10-23-accounts-and-facility-ownership/.

Registering makes a draft listing exactly as the old open form did (no creator, the default map pin) and a
`pending` owner link; claiming makes only the link. Staff decide the link on the owner requests screen. The
contact details are the account's own, so nothing about the person is copied into the listing.

Duplicates are caught before anything is written: the same phone number on a listing of any status, or a
very similar name in the same area. Only a published or re-check-due listing may be offered back for
claiming; for a draft or hidden one the answer says nothing about it.
"""

from datetime import datetime

from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import CLAIMABLE_RESULT_LIMIT, DEFAULT_MAP_CENTRE, DUPLICATE_NAME_SIMILARITY
from app.models import Listing, PhoneNumber, User
from app.models.base import LinkStatus, ListingStatus
from app.repositories import (
    audit_repository,
    category_repository,
    facility_owner_repository,
    listing_repository,
)
from app.schemas.facility_registration import (
    ClaimableItem,
    ClaimableList,
    ClaimCreate,
    ClaimCreated,
    FacilityRegister,
    FacilityRegistered,
)
from app.schemas.owner_link import CategoryRef
from app.services.search_service import MATCH_THRESHOLD
from app.services.staff_listing_service import unique_slug

REGISTERED_THANKS = "Thanks. Our team will verify your facility before it is listed."
CLAIM_THANKS = "Thanks. Our team will phone the facility to check."
ALREADY_LISTED = "A facility like this is already listed. You can ask to manage it instead."
ALREADY_REGISTERED = "This facility is already registered. Please contact us."
ALREADY_MANAGER = "You already manage this facility."
REQUEST_WAITING = "Your request for this facility is waiting for our team."

# A person can ask to manage a listing the public can see, or one that is only waiting for its next check.
CLAIMABLE_STATUSES = (ListingStatus.published, ListingStatus.recheck_due)


class RegistrationCategoryError(Exception):
    """The category does not exist or is an emergency category (staff add those). The route answers 422."""


class SimilarListingError(Exception):
    """A listing like this one exists. `listing_id` is set only when the person may claim it."""

    def __init__(self, listing_id: int | None) -> None:
        super().__init__("similar listing")
        self.listing_id = listing_id

    @property
    def message(self) -> str:
        return ALREADY_LISTED if self.listing_id is not None else ALREADY_REGISTERED


class ListingNotClaimableError(Exception):
    """There is no such listing, or it is not published or waiting for a check. The route answers 404."""


class AlreadyManagerError(Exception):
    """The person already has an approved link on this listing."""


class RequestWaitingError(Exception):
    """The person's request for this listing is already waiting for staff."""


async def _refuse_duplicates(session: AsyncSession, payload: FacilityRegister) -> None:
    similar = await listing_repository.find_by_phone_number(session, payload.phone)
    if similar is None:
        similar = await listing_repository.find_similar_name_in_area(
            session, payload.facility_name, payload.area, DUPLICATE_NAME_SIMILARITY
        )
    if similar is not None:
        raise SimilarListingError(similar.id if similar.status in CLAIMABLE_STATUSES else None)


async def _write_request_entry(
    session: AsyncSession, user: User, listing_id: int, moment: datetime
) -> None:
    """The audit row of a new request. The person is in `reference` as `user:{id}` (so the activity log says
    "About: name"). No phone, note or reason is written to it."""
    await audit_repository.add_entry(
        session,
        user_id=user.id,
        listing_id=listing_id,
        action="owner_request",
        field_changed="status",
        new_value=LinkStatus.pending.value,
        reference=f"user:{user.id}",
        changed_at=moment,
    )


async def register_facility(
    session: AsyncSession, user: User, payload: FacilityRegister, moment: datetime
) -> FacilityRegistered:
    category = await category_repository.get_by_slug(session, payload.category)
    if category is None or category.is_emergency:
        raise RegistrationCategoryError(payload.category)
    await _refuse_duplicates(session, payload)
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
    link = await facility_owner_repository.request_link(
        session, listing.id, user.id, payload.role, moment, payload.notes  # type: ignore[arg-type]
    )
    await audit_repository.add_entry(
        session,
        user_id=user.id,
        listing_id=listing.id,
        action="create",
        reference="facility-registration",
        changed_at=moment,
    )
    await _write_request_entry(session, user, listing.id, moment)  # type: ignore[arg-type]
    await session.commit()
    return FacilityRegistered(
        message=REGISTERED_THANKS, listing_id=listing.id, link_id=link.id  # type: ignore[arg-type]
    )


async def find_claimable(session: AsyncSession, search_text: str) -> ClaimableList:
    text = search_text.strip()
    if len(text) < 2:
        return ClaimableList(items=[])
    rows = await listing_repository.search_claimable(
        session, text, MATCH_THRESHOLD, CLAIMABLE_RESULT_LIMIT
    )
    return ClaimableList(
        items=[
            ClaimableItem(
                id=listing.id,  # type: ignore[arg-type]
                name=listing.name,
                area=listing.area,
                category=CategoryRef(slug=category.slug, name=category.name),
            )
            for listing, category in rows
        ]
    )


async def claim_listing(
    session: AsyncSession, user: User, payload: ClaimCreate, moment: datetime
) -> ClaimCreated:
    listing = await listing_repository.get_by_id(session, payload.listing_id)
    if listing is None or listing.status not in CLAIMABLE_STATUSES:
        raise ListingNotClaimableError
    existing = await facility_owner_repository.get_for(session, listing.id, user.id)  # type: ignore[arg-type]
    if existing is not None and existing.status == LinkStatus.approved.value:
        raise AlreadyManagerError
    if existing is not None and existing.status == LinkStatus.pending.value:
        raise RequestWaitingError
    link = await facility_owner_repository.request_link(
        session, listing.id, user.id, payload.role, moment, payload.reason  # type: ignore[arg-type]
    )
    await _write_request_entry(session, user, listing.id, moment)  # type: ignore[arg-type]
    await session.commit()
    return ClaimCreated(message=CLAIM_THANKS, link_id=link.id)  # type: ignore[arg-type]
