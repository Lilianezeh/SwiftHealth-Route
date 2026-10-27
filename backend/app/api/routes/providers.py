"""A provider's own facility. HTTP only: the rules are in services/provider_service.py.
Contract: specs/backend/api-spec.md, section 7 (FR-43)."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment, get_session, require_role
from app.models import User
from app.models.base import Role
from app.schemas.owner_link import OwnerList
from app.schemas.provider import ProviderListing, ProviderListingUpdate
from app.services import owner_link_service, provider_service

router = APIRouter(prefix="/provider", tags=["Providers"])

NO_LISTING = "No listing is linked to your account."


@router.get(
    "/listings",
    response_model=OwnerList,
    summary="Provider: every facility link I have, with its state (waiting, approved or removed)",
)
async def list_my_links(
    provider: User = Depends(require_role(Role.provider)),
    session: AsyncSession = Depends(get_session),
) -> OwnerList:
    return await owner_link_service.my_links(session, provider)


@router.get(
    "/listings/{listing_id}",
    response_model=ProviderListing,
    summary="Provider: one of my listings (needs an approved link)",
    responses={404: {"description": "No approved link to this listing."}},
)
async def get_one_of_my_listings(
    listing_id: int,
    provider: User = Depends(require_role(Role.provider)),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> ProviderListing:
    try:
        return await provider_service.get_own_detail(session, provider, moment, listing_id)
    except provider_service.NoLinkedListingError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NO_LISTING) from None


@router.patch(
    "/listings/{listing_id}",
    response_model=ProviderListing,
    summary="Provider: change description, services, opening hours or phones of one of my listings",
    responses={404: {"description": "No approved link to this listing."}},
)
async def update_one_of_my_listings(
    listing_id: int,
    payload: ProviderListingUpdate,
    provider: User = Depends(require_role(Role.provider)),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> ProviderListing:
    try:
        return await provider_service.update_own_listing(session, provider, payload, moment, listing_id)
    except provider_service.NoLinkedListingError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NO_LISTING) from None


@router.get(
    "/listing",
    response_model=ProviderListing,
    summary="Provider: my own listing",
    responses={404: {"description": NO_LISTING}},
)
async def get_my_listing(
    provider: User = Depends(require_role(Role.provider)),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> ProviderListing:
    try:
        return await provider_service.get_own_detail(session, provider, moment)
    except provider_service.NoLinkedListingError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NO_LISTING) from None


@router.patch(
    "/listing",
    response_model=ProviderListing,
    summary="Provider: change description, services, opening hours or phones",
    responses={404: {"description": NO_LISTING}},
)
async def update_my_listing(
    payload: ProviderListingUpdate,
    provider: User = Depends(require_role(Role.provider)),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> ProviderListing:
    try:
        return await provider_service.update_own_listing(session, provider, payload, moment)
    except provider_service.NoLinkedListingError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NO_LISTING) from None
