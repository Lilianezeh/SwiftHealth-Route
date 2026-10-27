"""A provider reads and edits their own listing. Requirements: FR-43, FR-50, FR-38, NFR-06.
Decisions I1 and I2 in specs/2026-10-20-providers-payments/requirements.md; accounts phase 6a.

A provider reaches a listing only through an APPROVED owner link (`facility_owners`): the listing is found
from the provider's own user id and the links, never from an id alone, so a provider cannot name a listing
they have no link to (it is "not linked", not "forbidden", so existence is not revealed). `listings.owner_id`
is no longer read. Their edit goes live at once; a change of phones or hours also makes the listing due for an
urgent re-check but keeps it visible (`verification_due`).
"""

from datetime import datetime

from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.models import Listing, User
from app.repositories import facility_owner_repository
from app.schemas.provider import ProviderListing, ProviderListingUpdate
from app.services import staff_listing_service

URGENT_RECHECK_FIELDS = frozenset({"phones", "opening_hours"})
PROVIDER_CHANGE_REFERENCE = "provider-change"


class NoLinkedListingError(Exception):
    """The provider has no approved link to a listing (or to this listing)."""


class NotAnOwnerError(Exception):
    """The provider has approved links, but none as an owner: a manager cannot pay (decision D4)."""


async def get_own_listing(
    session: AsyncSession,
    provider: User,
    *,
    listing_id: int | None = None,
    owner_only: bool = False,
) -> Listing:
    """The listing the provider acts on: the one asked for, or their approved link with the lowest listing id.

    With `owner_only` (paying for Featured) a manager link does not count: `NotAnOwnerError` if the provider
    has approved links but none as an owner. Raises `NoLinkedListingError` when there is no approved link.
    """
    if listing_id is not None:
        found = await facility_owner_repository.approved_link_for(session, provider.id, listing_id)  # type: ignore[arg-type]
        if found is None:
            raise NoLinkedListingError
        link, listing = found
        if owner_only and link.role != "owner":
            raise NotAnOwnerError
        return listing
    found = await facility_owner_repository.first_approved_listing(
        session, provider.id, owner_only=owner_only  # type: ignore[arg-type]
    )
    if found is None:
        if owner_only and await facility_owner_repository.first_approved_listing(session, provider.id):  # type: ignore[arg-type]
            raise NotAnOwnerError
        raise NoLinkedListingError
    return found[1]


async def get_own_detail(
    session: AsyncSession, provider: User, moment: datetime, listing_id: int | None = None
) -> ProviderListing:
    listing = await get_own_listing(session, provider, listing_id=listing_id)
    detail = await staff_listing_service.get_staff_detail(session, listing.id, moment)  # type: ignore[arg-type]
    return ProviderListing(**detail.model_dump(), featured_price_naira=settings.featured_price)


async def update_own_listing(
    session: AsyncSession,
    provider: User,
    payload: ProviderListingUpdate,
    moment: datetime,
    listing_id: int | None = None,
) -> ProviderListing:
    listing = await get_own_listing(session, provider, listing_id=listing_id)
    await staff_listing_service.update_listing(
        session,
        provider,
        listing,
        payload,
        moment,
        urgent_recheck_fields=URGENT_RECHECK_FIELDS,
        recheck_reference=PROVIDER_CHANGE_REFERENCE,
    )
    return await get_own_detail(session, provider, moment, listing_id)


__all__ = [
    "NoLinkedListingError",
    "NotAnOwnerError",
    "get_own_detail",
    "get_own_listing",
    "update_own_listing",
]
