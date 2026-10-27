"""Featured-listing payments with Paystack, in test mode only. Requirements: FR-44, FR-46, NFR-06.
Decisions I3 to I10 in specs/2026-10-20-providers-payments/requirements.md.

A payment has no table of its own. It starts here (`start_featured_payment`) and is confirmed only by a
verified webhook (`apply_charge_success`), which sets `featured_until` and writes an audit entry whose
reference is the Paystack reference. Money is a Decimal; it becomes kobo, an integer, only in the call to
Paystack.
"""

import logging
import re
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.integrations import paystack
from app.models import User
from app.models.base import ListingStatus
from app.repositories import audit_repository, listing_repository
from app.schemas.payment import FeaturedStarted, PaymentVerified
from app.services import provider_service

logger = logging.getLogger(__name__)

FEATURED_PERIOD = timedelta(days=30)  # FR-44
REFERENCE_SHAPE = re.compile(r"SH-(\d+)-(\d+)")  # decision I5


class ListingNotPublishedError(Exception):
    """Only a published listing can be featured."""


def amount_in_kobo() -> int:
    """The price in kobo: `int(price * 100)` (CLAUDE.md). Decimal arithmetic is exact: no rounding."""
    return int(settings.featured_price * 100)


def reference_for(listing_id: int, moment: datetime) -> str:
    """`SH-<listing id>-<unix seconds>`, as the API spec says (decision I5)."""
    return f"SH-{listing_id}-{int(moment.timestamp())}"


async def start_featured_payment(session: AsyncSession, provider: User, moment: datetime) -> FeaturedStarted:
    """Asks Paystack for a checkout page for the provider's own listing. Nothing is saved: no money moved.

    Raises provider_service.NoLinkedListingError, ListingNotPublishedError, and the errors of
    integrations/paystack.py (not set up, live key, could not start).
    """
    # Only an owner link pays: a manager gets NotAnOwnerError (decision D4).
    listing = await provider_service.get_own_listing(session, provider, owner_only=True)
    if listing.status != ListingStatus.published:
        raise ListingNotPublishedError
    started = await paystack.initialize_transaction(
        email=provider.email,
        amount_kobo=amount_in_kobo(),
        reference=reference_for(listing.id, moment),
        callback_url=f"{settings.web_app_address}/provider/payment-complete",
        metadata={"listing_id": listing.id},
    )
    return FeaturedStarted(
        authorization_url=started.authorization_url,
        reference=started.reference,
        amount_naira=settings.featured_price,
    )


@dataclass(frozen=True)
class ChargeEvent:
    """What a webhook must carry for a payment to count: our reference, the listing, the amount in kobo."""

    reference: str
    listing_id: int
    amount_kobo: int


def listing_id_of(reference: str) -> int | None:
    """The listing id in a reference of the shape `SH-<listing id>-<digits>`, or None for other text."""
    match = REFERENCE_SHAPE.fullmatch(reference)
    return int(match.group(1)) if match else None


def reference_of(payload: dict) -> str:
    """The reference of an event, for the log (the only thing of a webhook that is logged), or "unknown"."""
    data = payload.get("data")
    reference = data.get("reference") if isinstance(data, dict) else None
    return reference if isinstance(reference, str) and len(reference) <= 100 else "unknown"


def parse_charge_success(payload: dict) -> ChargeEvent | None:
    """The payment in a webhook body, or None when it is not a good `charge.success` (then it is ignored).

    Good means: the event is `charge.success`, `data.status` is "success", the reference has our shape and
    its listing id is the one in `data.metadata.listing_id`, and `data.amount` is a whole number of kobo
    that is at least the current price (decisions I5 and I6). Plain `def`: it only looks at values in memory.
    """
    data = payload.get("data")
    if (
        payload.get("event") != "charge.success"
        or not isinstance(data, dict)
        or data.get("status") != "success"
    ):
        return None
    reference, metadata, amount = data.get("reference"), data.get("metadata"), data.get("amount")
    if not isinstance(reference, str) or not isinstance(metadata, dict):
        return None
    metadata_listing_id = metadata.get("listing_id")
    # bool is a kind of int in Python, and a float amount is not "a whole number of kobo": both are refused.
    if isinstance(metadata_listing_id, bool) or not isinstance(metadata_listing_id, int):
        return None
    if isinstance(amount, bool) or not isinstance(amount, int) or amount < amount_in_kobo():
        return None
    if listing_id_of(reference) != metadata_listing_id:
        return None
    return ChargeEvent(reference=reference, listing_id=metadata_listing_id, amount_kobo=amount)


async def apply_charge_success(session: AsyncSession, event: ChargeEvent, moment: datetime) -> bool:
    """Features the listing for 30 more days and writes the audit entry. True if applied, False if not.

    Not applied (False) when the payment was applied before (the same reference: FR-46) or the listing
    does not exist. The lock, the check, the change and the audit entry are one transaction, so two
    webhooks for the same reference cannot both apply. `moment` is passed in (never read from the clock).
    """
    await audit_repository.lock_reference(session, event.reference)
    if await audit_repository.find_payment(session, event.reference) is not None:
        await session.rollback()  # ends the transaction and so releases the lock
        return False
    listing = await listing_repository.get_by_id(session, event.listing_id)
    if listing is None:
        await session.rollback()
        return False

    old_until = listing.featured_until
    start = old_until if old_until is not None and old_until > moment else moment
    listing.featured_until = start + FEATURED_PERIOD
    listing.updated_at = moment
    session.add(listing)
    await audit_repository.add_entry(
        session,
        user_id=None,
        listing_id=listing.id,
        action=audit_repository.PAYMENT_ACTION,
        field_changed="featured_until",
        old_value=old_until.isoformat() if old_until else None,
        new_value=listing.featured_until.isoformat(),
        reference=event.reference,
        changed_at=moment,
    )
    await session.commit()
    return True


class ReferenceNotFoundError(Exception):
    """The reference is not of the caller's listing (it has the wrong shape or another listing's id)."""


async def verify_payment(session: AsyncSession, provider: User, reference: str) -> PaymentVerified:
    """Has the webhook for this reference been applied? It does not ask Paystack (decision I9)."""
    listing = await provider_service.get_own_listing(session, provider, owner_only=True)
    if listing_id_of(reference) != listing.id:
        raise ReferenceNotFoundError
    entry = await audit_repository.find_payment(session, reference)
    if entry is None:
        return PaymentVerified(status="pending", featured_until=None)
    return PaymentVerified(status="success", featured_until=listing.featured_until)
