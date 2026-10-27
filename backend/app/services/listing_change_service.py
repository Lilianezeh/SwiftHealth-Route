"""A facility moves to a new address or closes. Requirements: FR-53, US-20, FR-38.
Decision D3 in specs/2026-10-23-accounts-and-facility-ownership/requirements.md; rules in
specs/backend/api-spec.md, "Phase 8a".

A move writes one audit row per changed field (the old value is never lost: that is the address history)
and puts a published listing to `recheck_due` so it leaves the public at once. An owner's move never sets
the map pin: the pin goes back to the default centre and staff set the real one. A closure hides the
listing and keeps every row. Nothing here deletes anything. No HTTP: the routes turn the domain errors
into status codes, and who may do this is `access_service`.
"""

from dataclasses import dataclass
from datetime import datetime

from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import DEFAULT_MAP_CENTRE
from app.models import Listing, User
from app.models.base import ListingStatus, Role
from app.repositories import audit_repository
from app.schemas.listing_change import (
    AddressHistory,
    AddressHistoryItem,
    CloseResult,
    ListingClose,
    ListingMove,
    MoveResult,
)
from app.services import staff_alert_service
from app.services.staff_alert_service import StaffAlert
from app.services.staff_listing_service import is_default_pin

BY_OWNER = "by-owner"  # the `reference` of the rows of a move made by a provider
MOVED_AND_HIDDEN = "Moved. The listing is hidden until our team re-checks it."
MOVED_NOT_PUBLIC = "Moved. Our team will check the new address before it is listed."
READABLE_FIELDS = ("address", "area", "landmark")


class ClosedListingError(Exception):
    """A closed listing cannot be moved. The route answers 400."""


class NothingChangedError(Exception):
    """Every value equals the stored one. The route answers 400."""


class AlreadyClosedError(Exception):
    """The listing is closed already. The route answers 400."""


@dataclass
class MoveOutcome:
    result: MoveResult
    alert: StaffAlert | None  # set when a provider moved it; the route sends it after the answer


@dataclass
class CloseOutcome:
    result: CloseResult
    alert: StaffAlert | None


def _text(value: object) -> str | None:
    return None if value is None else str(value)


async def move_listing(
    session: AsyncSession, user: User, listing: Listing, payload: ListingMove, moment: datetime
) -> MoveOutcome:
    if listing.closed_at is not None:
        raise ClosedListingError
    by_owner = user.role == Role.provider
    wanted: dict[str, object] = {"address": payload.address, "area": payload.area}
    if "landmark" in payload.model_fields_set:
        wanted["landmark"] = payload.landmark
    changes = [(field, getattr(listing, field), value) for field, value in wanted.items()]
    changes = [(field, old, new) for field, old, new in changes if old != new]
    if not changes:
        raise NothingChangedError

    # The pin: an owner never sets it (it goes back to the default); staff may, else it stays as it is.
    pin: tuple[float, float] | None = DEFAULT_MAP_CENTRE if by_owner else None
    if not by_owner and payload.latitude is not None and payload.longitude is not None:
        pin = (payload.latitude, payload.longitude)
    pin_changes = []
    if pin is not None:
        pin_changes = [
            (field, getattr(listing, field), value)
            for field, value in zip(("latitude", "longitude"), pin, strict=True)
            if getattr(listing, field) != value
        ]

    for field, _old, new in changes + pin_changes:
        setattr(listing, field, new)
    changed_readable = [field for field, _old, _new in changes]
    all_rows = [(field, old, new) for field, old, new in changes + pin_changes]

    old_status = listing.status
    if listing.status == ListingStatus.published:
        listing.status = ListingStatus.recheck_due
        all_rows.append(("status", old_status.value, ListingStatus.recheck_due.value))
    if listing.status == ListingStatus.recheck_due:
        listing.next_check_due = moment  # due now, so it tops the Re-checks list
    listing.updated_at = moment
    session.add(listing)
    for field, old, new in all_rows:
        await audit_repository.add_entry(
            session,
            user_id=user.id,
            listing_id=listing.id,
            action="move",
            field_changed=field,
            old_value=_text(old),
            new_value=_text(new),
            reference=BY_OWNER if by_owner else None,
            changed_at=moment,
        )
    alert = None
    if by_owner:
        alert = await staff_alert_service.load_owner_change_alert(session, listing.name, "moved")
    await session.commit()
    hidden = listing.status == ListingStatus.recheck_due
    return MoveOutcome(
        result=MoveResult(
            listing_id=listing.id,  # type: ignore[arg-type]
            status=listing.status.value,
            changed=changed_readable,
            pin_needs_setting=is_default_pin(listing.latitude, listing.longitude),
            message=MOVED_AND_HIDDEN if hidden else MOVED_NOT_PUBLIC,
        ),
        alert=alert,
    )


async def close_listing(
    session: AsyncSession, user: User, listing: Listing, payload: ListingClose, moment: datetime
) -> CloseOutcome:
    if listing.closed_at is not None:
        raise AlreadyClosedError
    old_status = listing.status
    listing.status = ListingStatus.hidden
    listing.closed_at = moment
    listing.closed_reason = payload.reason
    listing.updated_at = moment
    session.add(listing)
    await audit_repository.add_entry(
        session,
        user_id=user.id,
        listing_id=listing.id,
        action="close",
        field_changed="status",
        old_value=old_status.value,
        new_value=ListingStatus.hidden.value,
        reference=payload.reason,
        changed_at=moment,
    )
    alert = None
    if user.role == Role.provider:
        alert = await staff_alert_service.load_owner_change_alert(session, listing.name, "closed")
    await session.commit()
    return CloseOutcome(
        result=CloseResult(
            listing_id=listing.id,  # type: ignore[arg-type]
            status=ListingStatus.hidden.value,
            closed_at=moment,
        ),
        alert=alert,
    )


async def address_history(session: AsyncSession, user: User, listing: Listing) -> AddressHistory:
    """The address, area and landmark changes, newest first. A provider never sees who made a change."""
    rows = await audit_repository.list_address_history(session, listing.id)  # type: ignore[arg-type]
    show_names = user.role != Role.provider
    return AddressHistory(
        items=[
            AddressHistoryItem(
                changed_at=entry.changed_at,
                field=entry.field_changed,  # type: ignore[arg-type]
                old_value=entry.old_value,
                new_value=entry.new_value,
                kind="move" if entry.action == "move" else "edit",
                by=name if show_names else None,
            )
            for entry, name in rows
        ]
    )
