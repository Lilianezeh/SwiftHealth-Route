"""Owner links: who may edit or pay for a listing, and the staff queue that decides.
Requirements: FR-50, US-19, FR-38.
Spec: specs/backend/api-spec.md section 7, "Phase 6a"; decisions D1, D4 and D5 of
specs/2026-10-23-accounts-and-facility-ownership/.

A provider reaches a listing only through an APPROVED link. Editors and admins phone the facility, write down
who they reached, and approve, reject or remove a link. Each decision writes one audit entry: the listing in
`listing_id`, the person in `reference` as `user:{id}` (so the activity log says "About: name"), the two
states in the old and new value, and no phone number or note.
"""

from datetime import datetime

from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.models import FacilityOwner, User
from app.models.base import LinkStatus
from app.repositories import audit_repository, facility_owner_repository
from app.schemas.owner_link import (
    CategoryRef,
    OwnerList,
    OwnerListItem,
    QueueItem,
    QueueList,
    QueueListing,
    QueuePerson,
    QueuePhone,
)
from app.services import owner_fee_service
from app.services.owner_fee_service import fee_state


class LinkNotFoundError(Exception):
    """No link has this id."""


class LinkNotPendingError(Exception):
    """The link is not waiting for a decision."""


class LinkNotApprovedError(Exception):
    """The link is not approved, so it cannot be removed."""


async def my_links(session: AsyncSession, user: User, moment: datetime) -> OwnerList:
    """Every link of the caller, any state, by listing id. Only the caller's own: nothing else is read."""
    rows = await facility_owner_repository.list_for_user(session, user.id)  # type: ignore[arg-type]
    return OwnerList(
        fee_naira=settings.owner_fee,
        grace_days=settings.owner_fee_grace_days,
        items=[
            OwnerListItem(
                link_id=link.id,  # type: ignore[arg-type]
                listing_id=listing.id,  # type: ignore[arg-type]
                name=listing.name,
                area=listing.area,
                category=CategoryRef(slug=category.slug, name=category.name),
                role=link.role,
                status=link.status,
                requested_at=link.requested_at,
                paid_until=link.paid_until,
                fee_state=fee_state(link.status, link.paid_until, moment),
            )
            for link, listing, category in rows
        ]
    )


async def queue(session: AsyncSession) -> QueueList:
    """The links that wait, oldest first, with the facility's own phone numbers to call."""
    rows = await facility_owner_repository.list_pending(session)
    phones = await facility_owner_repository.phones_of(session, {listing.id for _, _, listing in rows})  # type: ignore[misc]
    items = [
        QueueItem(
            id=link.id,  # type: ignore[arg-type]
            role=link.role,
            requested_at=link.requested_at,
            reason=link.note,
            person=QueuePerson(id=user.id, name=user.name, email=user.email, phone=user.phone),  # type: ignore[arg-type]
            listing=QueueListing(
                id=listing.id,  # type: ignore[arg-type]
                name=listing.name,
                area=listing.area,
                phones=[
                    QueuePhone(number=phone.number, label=phone.label, is_primary=phone.is_primary)
                    for phone in phones.get(listing.id, [])  # type: ignore[arg-type]
                ],
            ),
        )
        for link, user, listing in rows
    ]
    return QueueList(items=items, total=len(items))


async def _load(session: AsyncSession, link_id: int) -> FacilityOwner:
    link = await facility_owner_repository.get_by_id(session, link_id)
    if link is None:
        raise LinkNotFoundError
    return link


async def _audit(
    session: AsyncSession, staff: User, action: str, link: FacilityOwner, old: str, new: str, moment: datetime
) -> None:
    await audit_repository.add_entry(
        session,
        user_id=staff.id,
        listing_id=link.listing_id,
        action=action,
        field_changed="status",
        old_value=old,
        new_value=new,
        reference=f"user:{link.user_id}",
        changed_at=moment,
    )


async def approve(
    session: AsyncSession, staff: User, link_id: int, note: str, moment: datetime
) -> FacilityOwner:
    link = await _load(session, link_id)
    if link.status != LinkStatus.pending.value:
        raise LinkNotPendingError
    link.status = LinkStatus.approved.value
    link.approved_by, link.approved_at, link.note = staff.id, moment, note
    await facility_owner_repository.save(session, link)
    await _audit(session, staff, "owner_approve", link, "pending", "approved", moment)
    await session.commit()
    return link


async def reject(
    session: AsyncSession, staff: User, link_id: int, note: str | None, moment: datetime
) -> tuple[FacilityOwner, str | None]:
    """Rejects a request that waits, and gives the owner's payment back in full (owner fee, question Q10).

    Returns the link and the refund: "done", "pending" (Paystack did not accept it yet; the nightly job asks
    again) or None (nothing was paid). The rejection is committed first, so a failing refund never
    undoes it."""
    link = await _load(session, link_id)
    if link.status != LinkStatus.pending.value:
        raise LinkNotPendingError
    link.status = LinkStatus.removed.value
    link.removed_by, link.removed_at, link.note = staff.id, moment, note
    await facility_owner_repository.save(session, link)
    await _audit(session, staff, "owner_reject", link, "pending", "removed", moment)
    await session.commit()
    refund = await owner_fee_service.refund_link_payment(session, link, staff.id, moment)
    if refund != "none":
        await owner_fee_service.tell_refund(session, link)
    return link, refund if refund in ("done", "pending") else None


async def remove(
    session: AsyncSession, staff: User, link_id: int, note: str | None, moment: datetime
) -> FacilityOwner:
    link = await _load(session, link_id)
    if link.status != LinkStatus.approved.value:
        raise LinkNotApprovedError
    link.status, link.removed_by, link.removed_at = LinkStatus.removed.value, staff.id, moment
    if note:
        link.note = note
    await facility_owner_repository.save(session, link)
    await _audit(session, staff, "owner_remove", link, "approved", "removed", moment)
    await session.commit()
    return link
