"""The owner fee: what a facility owner pays each calendar month to claim and manage a listing.
Requirements: FR-44, FR-46, FR-50, NFR-06. Spec: specs/2026-10-29-owner-fee/. Paystack TEST mode only.

Listing a facility stays free; this fee is for the owner's tools (editing, moves, closures,
branches, Featured). A new request waits as `awaiting_payment` and staff do not see it. The signed
Paystack webhook (and only it) confirms the payment (`apply_charge_success`): the link becomes
`pending` for staff, or stays/returns to `approved` for a renewal, and `paid_until` moves one
calendar month on. A payment has no table of its own: it is an audit entry whose reference is ours
(`SO-<link id>-<unix seconds>`), exactly like a Featured payment. Money is a Decimal; it becomes
kobo, an integer, only in the call to Paystack. Plain `def` for pure rules, `async def` only where
the database or an outside service is awaited.
"""

import logging
import re
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.core.months import add_one_month
from app.integrations import paystack
from app.models import FacilityOwner, User
from app.models.base import LinkStatus
from app.repositories import audit_repository, facility_owner_repository, listing_repository, user_repository
from app.schemas.payment import (
    LinkCancelled,
    OwnerFeeStarted,
    OwnerFeeVerified,
    PaymentList,
    PaymentListItem,
)
from app.services import owner_fee_mail

logger = logging.getLogger(__name__)

REFERENCE_SHAPE = re.compile(r"SO-(\d+)-(\d+)")
FEE_KIND = "owner_fee"  # in the Paystack metadata, so a Featured event can never be read as an owner fee
PAYABLE_STATUSES = (
    LinkStatus.awaiting_payment.value,
    LinkStatus.approved.value,
    LinkStatus.lapsed.value,
    LinkStatus.ending.value,
)


class LinkNotFoundError(Exception):
    """No link of the caller has this id (or the reference is not of the caller's link)."""


class LinkNotPayableError(Exception):
    """The link is waiting for staff or removed: there is nothing to pay for."""


class LinkAlreadyEndedError(Exception):
    """The link is already cancelled or removed."""


# --- pure rules ---


def amount_in_kobo() -> int:
    """The fee in kobo: `int(fee * 100)` (CLAUDE.md). Decimal arithmetic is exact: no rounding."""
    return int(settings.owner_fee * 100)


def reference_for(link_id: int, moment: datetime) -> str:
    """`SO-<link id>-<unix seconds>`; the `SO` tells it from a Featured reference (`SH-...`)."""
    return f"SO-{link_id}-{int(moment.timestamp())}"


def link_id_of(reference: str) -> int | None:
    """The link id in a reference of the shape `SO-<link id>-<digits>`, or None for any other text."""
    match = REFERENCE_SHAPE.fullmatch(reference)
    return int(match.group(1)) if match else None


def next_paid_until(paid_until: datetime | None, moment: datetime) -> datetime:
    """The end of the paid month after one more payment: a month after the old end if that is still ahead (an
    early payment loses nothing), else a month from now (a first or a late payment)."""
    base = paid_until if paid_until is not None and paid_until > moment else moment
    return add_one_month(base)


def fee_state(status: str, paid_until: datetime | None, moment: datetime) -> str:
    """Where a link is in the life of the fee: awaiting_payment, waiting_for_staff, paid, grace,
    lapsed, ending, ended or removed. "paid", "grace" and "ending" may manage the listing."""
    if status == LinkStatus.removed.value:
        return "removed"
    if status == LinkStatus.awaiting_payment.value:
        return "awaiting_payment"
    if status == LinkStatus.pending.value:
        return "waiting_for_staff"
    if status == LinkStatus.ending.value:
        return "ending" if paid_until is not None and paid_until >= moment else "ended"
    if status == LinkStatus.lapsed.value or paid_until is None:
        return "lapsed"
    if paid_until >= moment:
        return "paid"
    return "grace" if paid_until >= moment - timedelta(days=settings.owner_fee_grace_days) else "lapsed"


@dataclass(frozen=True)
class ChargeEvent:
    """What a webhook must carry for an owner-fee payment to count: our reference, the link, the kobo paid."""

    reference: str
    link_id: int
    amount_kobo: int


def parse_charge_success(payload: dict) -> ChargeEvent | None:
    """The owner-fee payment in a webhook body, or None when it is not one (then it is ignored).

    Good means: the event is `charge.success`, `data.status` is "success", the reference has our
    shape, its link id is the one in `data.metadata.link_id`, the metadata says this is an owner fee,
    and `data.amount` is a whole number of kobo that is at least the current fee. Plain `def`: it
    only looks at values in memory."""
    data = payload.get("data")
    if (
        payload.get("event") != "charge.success"
        or not isinstance(data, dict)
        or data.get("status") != "success"
    ):
        return None
    reference, metadata, amount = data.get("reference"), data.get("metadata"), data.get("amount")
    if not isinstance(reference, str) or not isinstance(metadata, dict) or metadata.get("kind") != FEE_KIND:
        return None
    link_id = metadata.get("link_id")
    # bool is a kind of int in Python, and a float amount is not "a whole number of kobo": both are refused.
    if isinstance(link_id, bool) or not isinstance(link_id, int):
        return None
    if isinstance(amount, bool) or not isinstance(amount, int) or amount < amount_in_kobo():
        return None
    if link_id_of(reference) != link_id:
        return None
    return ChargeEvent(reference=reference, link_id=link_id, amount_kobo=amount)


# --- paying ---


async def _own_link(session: AsyncSession, provider: User, link_id: int) -> FacilityOwner:
    link = await facility_owner_repository.get_by_id(session, link_id)
    if link is None or link.user_id != provider.id:
        raise LinkNotFoundError
    return link


async def start_payment(
    session: AsyncSession, provider: User, link_id: int, moment: datetime
) -> OwnerFeeStarted:
    """Asks Paystack for a checkout page for the fee of the provider's own link.

    Nothing is saved: no money moved.

    Raises LinkNotFoundError (not the caller's link), LinkNotPayableError and the errors of
    integrations/paystack.py (not set up, live key, could not start)."""
    link = await _own_link(session, provider, link_id)
    if link.status not in PAYABLE_STATUSES:
        raise LinkNotPayableError
    started = await paystack.initialize_transaction(
        email=provider.email,
        amount_kobo=amount_in_kobo(),
        reference=reference_for(link.id, moment),  # type: ignore[arg-type]
        callback_url=f"{settings.web_app_address}/provider/fee-complete",
        metadata={"link_id": link.id, "kind": FEE_KIND},
    )
    return OwnerFeeStarted(
        authorization_url=started.authorization_url,
        reference=started.reference,
        amount_naira=settings.owner_fee,
    )


async def apply_charge_success(session: AsyncSession, event: ChargeEvent, moment: datetime) -> bool:
    """Moves the paid month on, and the link on if it should move. True if applied, False if not.

    Not applied (False) when this reference was applied before (FR-46) or the link does not exist.
    The lock, the check, the change and the audit entry are one transaction, so two webhooks for the
    same reference cannot both apply. A payment for a removed link is recorded (so an admin can see
    and refund it) but changes nothing else. The receipt email is sent after the commit and never
    fails the payment."""
    await audit_repository.lock_reference(session, event.reference)
    if await audit_repository.find_payment(session, event.reference) is not None:
        await session.rollback()  # ends the transaction and so releases the lock
        return False
    link = await facility_owner_repository.get_by_id(session, event.link_id)
    if link is None:
        await session.rollback()
        return False

    old_until = link.paid_until
    new_until = next_paid_until(old_until, moment)
    period_start = old_until if old_until is not None and old_until > moment else moment
    removed = link.status == LinkStatus.removed.value
    if not removed:
        link.paid_until = new_until
        if link.status == LinkStatus.awaiting_payment.value:
            link.status = LinkStatus.pending.value  # now staff see it
        elif link.status in (LinkStatus.lapsed.value, LinkStatus.ending.value):
            link.status = LinkStatus.approved.value  # staff already verified this person: no new approval
        await facility_owner_repository.save(session, link)
    await audit_repository.add_entry(
        session,
        user_id=None,
        listing_id=link.listing_id,
        action=audit_repository.PAYMENT_ACTION,
        field_changed="paid_until",
        old_value=old_until.isoformat() if old_until else None,
        new_value=new_until.isoformat(),
        reference=event.reference,
        changed_at=moment,
    )
    await session.commit()
    if not removed:
        await _send_receipt(session, link, event, period_start, new_until)
    return True


async def _send_receipt(
    session: AsyncSession,
    link: FacilityOwner,
    event: ChargeEvent,
    period_start: datetime,
    period_end: datetime,
) -> None:
    user = await user_repository.get_by_id(session, link.user_id)
    listing = await listing_repository.get_by_id(session, link.listing_id)
    if user is None or listing is None:
        return
    subject, body = owner_fee_mail.receipt_texts(
        facility_name=listing.name,
        amount_kobo=event.amount_kobo,
        period_start=period_start,
        period_end=period_end,
        reference=event.reference,
    )
    await owner_fee_mail.send_best_effort(user.email, subject, body)


async def verify_payment(session: AsyncSession, provider: User, reference: str) -> OwnerFeeVerified:
    """Has the webhook for this reference been applied? It does not ask Paystack."""
    link_id = link_id_of(reference)
    if link_id is None:
        raise LinkNotFoundError
    link = await _own_link(session, provider, link_id)
    entry = await audit_repository.find_payment(session, reference)
    if entry is None:
        return OwnerFeeVerified(status="pending", link_status=link.status, paid_until=link.paid_until)
    return OwnerFeeVerified(status="success", link_status=link.status, paid_until=link.paid_until)


async def list_payments(session: AsyncSession, provider: User) -> PaymentList:
    """The caller's own owner-fee payments, newest first. Only the caller's own links are read."""
    rows = await facility_owner_repository.list_for_user(session, provider.id)  # type: ignore[arg-type]
    names = {link.id: listing.name for link, listing, _category in rows}
    listing_of = {link.id: link.listing_id for link, _listing, _category in rows}
    entries = await audit_repository.list_owner_fee_payments(session, set(listing_of.values()))
    items = []
    for entry in entries:
        link_id = link_id_of(entry.reference or "")
        if link_id is None or link_id not in names:
            continue
        items.append(
            PaymentListItem(
                reference=entry.reference or "",
                kind="owner_fee",
                listing_id=listing_of[link_id],
                listing_name=names[link_id],
                paid_at=entry.changed_at,
                paid_until=datetime.fromisoformat(entry.new_value) if entry.new_value else None,
            )
        )
    return PaymentList(items=items)


# --- giving a payment back, and cancelling ---


async def refund_link_payment(
    session: AsyncSession, link: FacilityOwner, actor_id: int | None, moment: datetime
) -> str:
    """Gives the newest payment of this link back in full.

    Returns "done", "pending" (Paystack did not accept it yet; the nightly job asks again) or "none"
    (nothing was paid). Every outcome is an audit entry with the payment's reference. The caller has
    already committed the change of the link. Paystack's error text, which can repeat an email, is
    never logged: only the class of the problem."""
    entry = await audit_repository.latest_owner_fee_payment(session, link.id)  # type: ignore[arg-type]
    if entry is None or entry.reference is None:
        return "none"
    reference = entry.reference
    if await audit_repository.find_by_action_and_reference(
        session, audit_repository.REFUND_ACTION, reference
    ):
        return "done"
    try:
        await paystack.create_refund(reference=reference)
    except (paystack.RefundError, paystack.PaymentsNotSetUpError, paystack.LiveKeyRefusedError) as error:
        logger.warning("Refund of %s not done yet (%s)", reference, type(error).__name__)
        if (
            await audit_repository.find_by_action_and_reference(
                session, audit_repository.REFUND_PENDING_ACTION, reference
            )
            is None
        ):
            await audit_repository.add_entry(
                session,
                user_id=actor_id,
                listing_id=link.listing_id,
                action=audit_repository.REFUND_PENDING_ACTION,
                reference=reference,
                changed_at=moment,
            )
            await session.commit()
        return "pending"
    await audit_repository.add_entry(
        session,
        user_id=actor_id,
        listing_id=link.listing_id,
        action=audit_repository.REFUND_ACTION,
        reference=reference,
        changed_at=moment,
    )
    await session.commit()
    return "done"


async def tell_refund(session: AsyncSession, link: FacilityOwner) -> None:
    """Tells the owner by email that the payment is being given back. Best effort."""
    user = await user_repository.get_by_id(session, link.user_id)
    listing = await listing_repository.get_by_id(session, link.listing_id)
    if user is None or listing is None:
        return
    subject, body = owner_fee_mail.refund_texts(listing.name)
    await owner_fee_mail.send_best_effort(user.email, subject, body)


async def cancel_link(session: AsyncSession, provider: User, link_id: int, moment: datetime) -> LinkCancelled:
    """The owner stops managing a facility. The listing is not touched: it stays public and free.

    A paid, approved link goes to `ending`: editing goes on to the end of the paid month (no refund
    of that month), then the nightly job removes it. A link that never gave access
    (`awaiting_payment`, `lapsed`) is removed at once. A link that is waiting for staff is withdrawn
    and its payment given back in full."""
    link = await _own_link(session, provider, link_id)
    old_status = link.status
    refund: str | None = None
    if old_status in (LinkStatus.ending.value, LinkStatus.removed.value):
        raise LinkAlreadyEndedError
    if old_status == LinkStatus.approved.value:
        link.status = LinkStatus.ending.value
    else:
        link.status, link.removed_by, link.removed_at = LinkStatus.removed.value, provider.id, moment
    await facility_owner_repository.save(session, link)
    await audit_repository.add_entry(
        session,
        user_id=provider.id,
        listing_id=link.listing_id,
        action="owner_cancel",
        field_changed="status",
        old_value=old_status,
        new_value=link.status,
        reference=f"user:{link.user_id}",
        changed_at=moment,
    )
    await session.commit()
    if old_status == LinkStatus.pending.value:
        refund = await refund_link_payment(session, link, provider.id, moment)
        if refund != "none":
            await tell_refund(session, link)
        refund = refund if refund in ("done", "pending") else None
    access_until = link.paid_until if link.status == LinkStatus.ending.value else None
    return LinkCancelled(link_id=link.id, status=link.status, access_until=access_until, refund=refund)  # type: ignore[arg-type]
