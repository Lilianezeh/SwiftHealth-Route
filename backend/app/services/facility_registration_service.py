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

from app.core.config import CLAIMABLE_RESULT_LIMIT, DEFAULT_MAP_CENTRE, DUPLICATE_NAME_SIMILARITY, settings
from app.models import Category, FacilityOwner, Listing, User
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
    FacilityRequestRead,
    OtherPhone,
)
from app.schemas.owner_link import CategoryRef
from app.schemas.staff_listing import HoursInput, ListingUpdate, PhoneInput, ServiceInput
from app.services import staff_listing_service
from app.services.owner_link_service import change_note_of
from app.services.search_service import MATCH_THRESHOLD
from app.services.staff_listing_service import (
    hours_rows,
    is_default_pin,
    phone_rows,
    service_rows,
    unique_slug,
)

REGISTERED_THANKS = "Thanks. Pay the first month and our team will verify your facility before it is listed."
DRAFT_SAVED = "Your draft is saved. Nothing is sent to our team and nothing is public until you send it."
RESENT_THANKS = "Thanks. Your changes are sent to our team."
CHANGES_SAVED = "Your changes are saved. Send them to our team when you are ready."
SAVED_MESSAGES = {
    LinkStatus.draft.value: DRAFT_SAVED,
    LinkStatus.awaiting_payment.value: REGISTERED_THANKS,
    LinkStatus.pending.value: RESENT_THANKS,
    LinkStatus.changes_requested.value: CHANGES_SAVED,
}
# The owner can edit a request in these states only: in the others staff or Paystack may be acting on it.
EDITABLE_STATUSES = (LinkStatus.draft.value, LinkStatus.changes_requested.value)
CLAIM_THANKS = "Thanks. Pay the first month and our team will phone the facility to check."
ALREADY_LISTED = "A facility like this is already listed. You can ask to manage it instead."
ALREADY_REGISTERED = "This facility is already registered. Please contact us."
ALREADY_MANAGER = "You already manage this facility."
REQUEST_WAITING = "Your request for this facility is waiting for our team."

# A link in one of these states already manages the facility (a lapsed or cancelled one pays instead
# of asking again).
MANAGING_STATUSES = (LinkStatus.approved.value, LinkStatus.lapsed.value, LinkStatus.ending.value)

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


class RequestNotFoundError(Exception):
    """The link is not the caller's (or there is none): the route answers 404 and says nothing more."""


class RequestNotEditableError(Exception):
    """The request is not a draft and did not need changes. The route answers 409."""


class ListingNotClaimableError(Exception):
    """There is no such listing, or it is not published or waiting for a check. The route answers 404."""


class AlreadyManagerError(Exception):
    """The person already has an approved link on this listing."""


class RequestWaitingError(Exception):
    """The person's request for this listing is already waiting for staff."""


async def _refuse_duplicates(
    session: AsyncSession, payload: FacilityRegister, excluding_id: int | None = None
) -> None:
    """`excluding_id` is the request's own listing when the owner edits it (not a duplicate of itself)."""
    similar = await listing_repository.find_by_phone_number(session, payload.phone, excluding_id)
    if similar is None:
        similar = await listing_repository.find_similar_name_in_area(
            session, payload.facility_name, payload.area, DUPLICATE_NAME_SIMILARITY, excluding_id
        )
    if similar is not None:
        raise SimilarListingError(similar.id if similar.status in CLAIMABLE_STATUSES else None)


async def _write_request_entry(
    session: AsyncSession, user: User, listing_id: int, moment: datetime,
    old_status: str | None = None, new_status: str = LinkStatus.awaiting_payment.value,
) -> None:
    """The audit row of a request that is sent (a new one, a draft, or one that needed changes). The person
    is in `reference` as `user:{id}` (so the activity log says "About: name"). No phone, note or reason is
    written to it."""
    await audit_repository.add_entry(
        session,
        user_id=user.id,
        listing_id=listing_id,
        action="owner_request",
        field_changed="status",
        old_value=old_status,
        new_value=new_status,
        reference=f"user:{user.id}",
        changed_at=moment,
    )


def _phone_inputs(payload: FacilityRegister) -> list[PhoneInput]:
    """The main number first (primary), then the others."""
    main = PhoneInput(number=payload.phone, is_primary=True, is_whatsapp=payload.phone_has_whatsapp)
    others = [
        PhoneInput(number=other.number, label=other.label, is_whatsapp=other.is_whatsapp)
        for other in payload.other_phones
    ]
    return [main, *others]


def _hours_inputs(payload: FacilityRegister) -> list[HoursInput]:
    """A facility that is open 24 hours has no daily hours."""
    return [] if payload.is_24_hours else payload.opening_hours


def _service_inputs(payload: FacilityRegister) -> list[ServiceInput]:
    return [ServiceInput(name=name) for name in payload.services]


async def _open_category(session: AsyncSession, slug: str) -> Category:
    category = await category_repository.get_by_slug(session, slug)
    if category is None or category.is_emergency:
        raise RegistrationCategoryError(slug)
    return category


async def register_facility(
    session: AsyncSession, user: User, payload: FacilityRegister, moment: datetime
) -> FacilityRegistered:
    category = await _open_category(session, payload.category)
    await _refuse_duplicates(session, payload)
    listing = Listing(
        slug=await unique_slug(session, payload.facility_name, payload.area),
        name=payload.facility_name,
        category_id=category.id,
        area=payload.area,
        address=payload.address,
        landmark=payload.landmark,
        description=payload.description,
        email=payload.email,
        is_24_hours=payload.is_24_hours,
        entrance_photo_url=payload.entrance_photo_url,
        # The pin the owner placed, or the default centre for staff to move (decision L5).
        latitude=payload.latitude if payload.latitude is not None else DEFAULT_MAP_CENTRE[0],
        longitude=payload.longitude if payload.longitude is not None else DEFAULT_MAP_CENTRE[1],
        status=ListingStatus.draft,
        created_by=None,
        created_at=moment,
        updated_at=moment,
    )
    await listing_repository.add_listing_with_details(
        session,
        listing,
        phone_rows(_phone_inputs(payload)),
        hours_rows(_hours_inputs(payload)),
        service_rows(_service_inputs(payload)),
    )
    link = await facility_owner_repository.request_link(
        session, listing.id, user.id, payload.role, moment, payload.notes,  # type: ignore[arg-type]
        status=LinkStatus.draft.value if payload.save_as_draft else LinkStatus.awaiting_payment.value,
    )
    await audit_repository.add_entry(
        session,
        user_id=user.id,
        listing_id=listing.id,
        action="create",
        reference="facility-registration",
        changed_at=moment,
    )
    if not payload.save_as_draft:  # a draft is not a request yet: it is written when the owner sends it
        await _write_request_entry(session, user, listing.id, moment)  # type: ignore[arg-type]
    await session.commit()
    return _saved_answer(listing.id, link)  # type: ignore[arg-type]


def _saved_answer(listing_id: int, link: FacilityOwner) -> FacilityRegistered:
    return FacilityRegistered(
        message=SAVED_MESSAGES[link.status],
        listing_id=listing_id,
        link_id=link.id,  # type: ignore[arg-type]
        status=link.status,
        fee_naira=settings.owner_fee,
    )


async def _own_link(session: AsyncSession, user: User, link_id: int) -> FacilityOwner:
    link = await facility_owner_repository.get_by_id(session, link_id)
    if link is None or link.user_id != user.id:
        raise RequestNotFoundError
    return link


async def read_request(session: AsyncSession, user: User, link_id: int) -> FacilityRequestRead:
    """The form of the caller's own request as saved, whatever its state."""
    link = await _own_link(session, user, link_id)
    rows = await listing_repository.get_detail_by_id(session, link.listing_id)
    if rows is None:
        raise RequestNotFoundError
    primary = next((phone for phone in rows.phones if phone.is_primary), rows.phones[0])
    return FacilityRequestRead(
        link_id=link.id,  # type: ignore[arg-type]
        listing_id=rows.listing.id,  # type: ignore[arg-type]
        status=link.status,
        role=link.role,
        notes=link.note,
        facility_name=rows.listing.name,
        category=rows.category.slug,
        area=rows.listing.area,
        address=rows.listing.address,
        landmark=rows.listing.landmark,
        description=rows.listing.description,
        email=rows.listing.email,
        phone=primary.number,
        phone_has_whatsapp=primary.is_whatsapp,
        other_phones=[
            OtherPhone(number=phone.number, label=phone.label, is_whatsapp=phone.is_whatsapp)
            for phone in rows.phones
            if phone is not primary
        ],
        is_24_hours=rows.listing.is_24_hours,
        opening_hours=[
            HoursInput(
                day_of_week=hours.day_of_week,
                opens_at=hours.opens_at,
                closes_at=hours.closes_at,
                is_closed=hours.is_closed,
            )
            for hours in rows.opening_hours
        ],
        services=[service.name for service in rows.services],
        latitude=rows.listing.latitude,
        longitude=rows.listing.longitude,
        map_pin_is_default=is_default_pin(rows.listing.latitude, rows.listing.longitude),
        entrance_photo_url=rows.listing.entrance_photo_url,
        change_note=await change_note_of(session, link, rows.listing.id),  # type: ignore[arg-type]
    )


async def save_request(
    session: AsyncSession, user: User, link_id: int, payload: FacilityRegister, moment: datetime
) -> FacilityRegistered:
    """Saves the form of a request that is a `draft` or needed changes, and sends it unless `save_as_draft`.

    Sending a draft asks for the first month (`awaiting_payment`); sending a request that needed changes puts
    it back in front of staff (`pending`: the first month is already paid). The link and the listing are saved
    in the one commit that `update_listing` makes."""
    link = await _own_link(session, user, link_id)
    if link.status not in EDITABLE_STATUSES:
        raise RequestNotEditableError
    listing = await listing_repository.get_by_id(session, link.listing_id)
    if listing is None:
        raise RequestNotFoundError
    await _open_category(session, payload.category)
    await _refuse_duplicates(session, payload, excluding_id=listing.id)
    link.role, link.note = payload.role, payload.notes
    if not payload.save_as_draft:
        old_status = link.status
        if old_status == LinkStatus.draft.value:
            link.status, link.requested_at = LinkStatus.awaiting_payment.value, moment
        else:
            link.status = LinkStatus.pending.value
        await _write_request_entry(session, user, listing.id, moment, old_status, link.status)  # type: ignore[arg-type]
    await facility_owner_repository.save(session, link)
    await staff_listing_service.update_listing(session, user, listing, _listing_update(payload), moment)
    return _saved_answer(listing.id, link)  # type: ignore[arg-type]


def _listing_update(payload: FacilityRegister) -> ListingUpdate:
    """The whole form as a change of the listing. The pin and the photo are special (decision L9): when the
    form leaves them out, what is stored stays; a photo sent as null removes the photo."""
    fields: dict[str, object] = {
        "name": payload.facility_name,
        "category": payload.category,
        "area": payload.area,
        "address": payload.address,
        "landmark": payload.landmark,
        "description": payload.description,
        "email": payload.email,
        "is_24_hours": payload.is_24_hours,
        "phones": _phone_inputs(payload),
        "opening_hours": _hours_inputs(payload),
        "services": _service_inputs(payload),
    }
    if payload.latitude is not None and payload.longitude is not None:
        fields["latitude"], fields["longitude"] = payload.latitude, payload.longitude
    if "entrance_photo_url" in payload.model_fields_set:
        fields["entrance_photo_url"] = payload.entrance_photo_url
    return ListingUpdate(**fields)  # type: ignore[arg-type]


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
    if existing is not None and existing.status in MANAGING_STATUSES:
        raise AlreadyManagerError
    if existing is not None and existing.status == LinkStatus.pending.value:
        raise RequestWaitingError
    link = await facility_owner_repository.request_link(
        session, listing.id, user.id, payload.role, moment, payload.reason  # type: ignore[arg-type]
    )
    if existing is None or existing.status == LinkStatus.removed.value:  # an unpaid request is not new
        await _write_request_entry(session, user, listing.id, moment)  # type: ignore[arg-type]
    await session.commit()
    return ClaimCreated(
        message=CLAIM_THANKS, link_id=link.id, status=link.status, fee_naira=settings.owner_fee  # type: ignore[arg-type]
    )
