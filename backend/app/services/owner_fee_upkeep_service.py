"""What the nightly job does for the owner fee. Requirements: FR-50, FR-46, NFR-07.
Spec: specs/2026-10-29-owner-fee/.

Four small steps, each safe to run again: (1) an approved link whose paid month and grace days
ended becomes `lapsed` (editing already stopped by itself, see
facility_owner_repository._link_may_manage; this makes the state visible and tells the owner);
(2) a cancelled (`ending`) link whose paid month ended is removed; (3) a reminder email goes out
7, 3 and 1 days before the paid month ends, once each; (4) a refund Paystack did not accept is
asked for again. A lapse or an end never touches the listing: it stays public and free. Every
change is an audit entry.
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.integrations import paystack
from app.models import FacilityOwner
from app.models.base import UNPAID_CLOSE_REASON, LinkStatus, ListingStatus
from app.repositories import audit_repository, facility_owner_repository, listing_repository, user_repository
from app.services import owner_fee_mail

logger = logging.getLogger(__name__)


@dataclass
class UpkeepResult:
    lapsed: int = 0
    ended: int = 0
    reminders: int = 0
    refunds_done: int = 0
    unpaid_closed: int = 0


async def _status_entry(
    session: AsyncSession, link: FacilityOwner, action: str, old: str, new: str, moment: datetime
) -> None:
    await audit_repository.add_entry(
        session,
        user_id=None,
        listing_id=link.listing_id,
        action=action,
        field_changed="status",
        old_value=old,
        new_value=new,
        reference=f"user:{link.user_id}",
        changed_at=moment,
    )


async def lapse_overdue(session: AsyncSession, moment: datetime) -> int:
    """Approved links past the paid month and the grace days become `lapsed`. Returns how many."""
    cutoff = moment - timedelta(days=settings.owner_fee_grace_days)
    links = await facility_owner_repository.list_approved_not_paid_since(session, cutoff)
    for link in links:
        link.status = LinkStatus.lapsed.value
        await facility_owner_repository.save(session, link)
        await _status_entry(
            session, link, "owner_lapse", LinkStatus.approved.value, LinkStatus.lapsed.value, moment
        )
    await session.commit()
    for link in links:
        user = await user_repository.get_by_id(session, link.user_id)
        listing = await listing_repository.get_by_id(session, link.listing_id)
        if user is not None and listing is not None:
            subject, body = owner_fee_mail.lapsed_texts(listing.name)
            await owner_fee_mail.send_best_effort(user.email, subject, body)
    return len(links)


async def end_cancelled(session: AsyncSession, moment: datetime) -> int:
    """Cancelled links whose paid month ended are removed (no email: the owner chose this).

    Returns how many."""
    links = await facility_owner_repository.list_ending_over(session, moment)
    for link in links:
        link.status, link.removed_by, link.removed_at = LinkStatus.removed.value, link.user_id, moment
        await facility_owner_repository.save(session, link)
        await _status_entry(
            session, link, "owner_end", LinkStatus.ending.value, LinkStatus.removed.value, moment
        )
    await session.commit()
    return len(links)


async def send_reminders(session: AsyncSession, moment: datetime) -> int:
    """One email for each approved, active link whose paid month ends in 7, 3 or 1 days (the setting).

    Counted in whole UTC days. An audit entry whose reference names the link, the end date and the
    day count keeps a second run of the same night, or a delayed run, from sending the same reminder
    again; after a renewal the end date is new, so the next month gets its own. Returns how many
    were sent."""
    wanted = settings.owner_fee_reminder_day_list
    if not wanted:
        return 0
    rows = await facility_owner_repository.list_approved_paid_between(
        session, moment, moment + timedelta(days=max(wanted) + 1)
    )
    sent = 0
    for link, user, listing in rows:
        paid_until = link.paid_until
        if paid_until is None:
            continue
        days_left = (paid_until.date() - moment.date()).days
        if days_left not in wanted:
            continue
        reference = f"link:{link.id}:{paid_until.date()}:{days_left}"
        if await audit_repository.find_by_action_and_reference(
            session, audit_repository.REMINDER_ACTION, reference
        ):
            continue
        await audit_repository.add_entry(
            session,
            user_id=None,
            listing_id=link.listing_id,
            action=audit_repository.REMINDER_ACTION,
            reference=reference,
            changed_at=moment,
        )
        await session.commit()
        subject, body = owner_fee_mail.reminder_texts(listing.name, paid_until, days_left)
        await owner_fee_mail.send_best_effort(user.email, subject, body)
        sent += 1
    return sent


async def retry_refunds(session: AsyncSession, moment: datetime) -> int:
    """Asks Paystack again for every refund that was not accepted. Returns how many are done now."""
    done = 0
    for waiting in await audit_repository.list_refunds_to_retry(session):
        if waiting.reference is None:
            continue
        try:
            await paystack.create_refund(reference=waiting.reference)
        except (paystack.RefundError, paystack.PaymentsNotSetUpError, paystack.LiveKeyRefusedError) as error:
            logger.warning("Refund of %s still not done (%s)", waiting.reference, type(error).__name__)
            continue
        await audit_repository.add_entry(
            session,
            user_id=None,
            listing_id=waiting.listing_id,
            action=audit_repository.REFUND_ACTION,
            reference=waiting.reference,
            changed_at=moment,
        )
        await session.commit()
        done += 1
    return done


async def close_unpaid_requests(session: AsyncSession, moment: datetime) -> int:
    """Ends every request whose first month was not paid within OWNER_FEE_UNPAID_DAYS (14). Returns how many.

    The link is removed (an audit entry, no person: the system did it). A draft listing that only
    that request made (nobody created it, no other link on it that is not removed) is closed:
    hidden, `closed_at`, `closed_reason` "unpaid". A listing someone only asked to claim, or that
    staff made, is never touched. Nothing is deleted, and staff never see any of it
    (listing_repository.not_an_unpaid_request)."""
    cutoff = moment - timedelta(days=settings.owner_fee_unpaid_days)
    links = await facility_owner_repository.list_unpaid_requested_before(session, cutoff)
    for link in links:
        link.status, link.removed_at, link.removed_by = LinkStatus.removed.value, moment, None
        await facility_owner_repository.save(session, link)
        await _status_entry(
            session, link, "owner_unpaid", LinkStatus.awaiting_payment.value, LinkStatus.removed.value, moment
        )
        await close_listing_made_by_request(
            session, link, moment, closed_by=None, reference=UNPAID_CLOSE_REASON
        )
    await session.commit()
    return len(links)


async def close_listing_made_by_request(
    session: AsyncSession, link: FacilityOwner, moment: datetime, *, closed_by: int | None, reference: str
) -> bool:
    """Closes the draft listing that only this (already removed) request made. True if it was closed.

    The listing is hidden with `closed_at` and `closed_reason` "unpaid", which is what keeps it out of
    staff's lists and lets the same phone number be registered again. Nothing is deleted. A listing that
    staff made, one that is not a draft (a published listing someone asked to claim), one already closed
    and one another person still has a link to are left alone. `closed_by` is the owner who withdrew it, or
    None when the nightly job did it; `reference` says why ("unpaid" or "withdrawn"). The caller commits."""
    listing = await listing_repository.get_by_id(session, link.listing_id)
    others = await facility_owner_repository.count_other_live_links(
        session, link.listing_id, link.id  # type: ignore[arg-type]
    )
    made_by_this_request = (
        listing is not None
        and listing.status == ListingStatus.draft
        and listing.created_by is None
        and listing.closed_at is None
        and others == 0
    )
    if listing is None or not made_by_this_request:
        return False
    listing.status = ListingStatus.hidden
    listing.closed_at, listing.closed_reason, listing.updated_at = moment, UNPAID_CLOSE_REASON, moment
    session.add(listing)
    await audit_repository.add_entry(
        session, user_id=closed_by, listing_id=listing.id, action="close", field_changed="status",
        old_value=ListingStatus.draft.value, new_value=ListingStatus.hidden.value,
        reference=reference, changed_at=moment,
    )
    return True


async def run_all(session: AsyncSession, moment: datetime) -> UpkeepResult:
    return UpkeepResult(
        lapsed=await lapse_overdue(session, moment),
        ended=await end_cancelled(session, moment),
        reminders=await send_reminders(session, moment),
        refunds_done=await retry_refunds(session, moment),
        unpaid_closed=await close_unpaid_requests(session, moment),
    )
