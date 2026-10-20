"""A provider reads and edits their own listing. Requirements: FR-43, FR-38, NFR-06.
Decisions I1 and I2 in specs/2026-10-20-providers-payments/requirements.md.

The listing is found from the provider's own user id (`listings.owner_id`), never from an id in the
request, so a provider cannot name another listing. Their edit goes live at once; a change of phones or
hours also makes the listing due for an urgent re-check but keeps it visible (`verification_due`).
"""

from datetime import datetime

from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.models import Listing, User
from app.repositories import listing_repository
from app.schemas.provider import ProviderListing, ProviderListingUpdate
from app.services import staff_listing_service

URGENT_RECHECK_FIELDS = frozenset({"phones", "opening_hours"})
PROVIDER_CHANGE_REFERENCE = "provider-change"


class NoLinkedListingError(Exception):
    """No listing has this provider as its owner."""


async def get_own_listing(session: AsyncSession, provider: User) -> Listing:
    listing = await listing_repository.get_by_owner_id(session, provider.id)
    if listing is None:
        raise NoLinkedListingError
    return listing


async def get_own_detail(session: AsyncSession, provider: User, moment: datetime) -> ProviderListing:
    listing = await get_own_listing(session, provider)
    detail = await staff_listing_service.get_staff_detail(session, listing.id, moment)
    return ProviderListing(**detail.model_dump(), featured_price_naira=settings.featured_price_naira)


async def update_own_listing(
    session: AsyncSession, provider: User, payload: ProviderListingUpdate, moment: datetime
) -> ProviderListing:
    listing = await get_own_listing(session, provider)
    await staff_listing_service.update_listing(
        session,
        provider,
        listing,
        payload,
        moment,
        urgent_recheck_fields=URGENT_RECHECK_FIELDS,
        recheck_reference=PROVIDER_CHANGE_REFERENCE,
    )
    return await get_own_detail(session, provider, moment)
