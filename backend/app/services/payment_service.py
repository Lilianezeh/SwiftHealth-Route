"""Featured-listing payments with Paystack, in test mode only. Requirements: FR-44, FR-46, NFR-06.
Decisions I3 to I10 in specs/2026-10-20-providers-payments/requirements.md.

A payment has no table of its own. It starts here (`start_featured_payment`) and is confirmed only by a
verified webhook (`apply_charge_success`), which sets `featured_until` and writes an audit entry whose
reference is the Paystack reference. Money is a Decimal; it becomes kobo, an integer, only in the call to
Paystack.
"""

from datetime import datetime

from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.integrations import paystack
from app.models import User
from app.models.base import ListingStatus
from app.schemas.payment import FeaturedStarted
from app.services import provider_service


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
    listing = await provider_service.get_own_listing(session, provider)
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
