"""A provider's own facility. HTTP only: the rules are in services/provider_service.py.
Contract: specs/backend/api-spec.md, section 7 (FR-43)."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment, get_session, require_role
from app.models import User
from app.models.base import Role
from app.schemas.provider import ProviderListing, ProviderListingUpdate
from app.services import provider_service

router = APIRouter(prefix="/provider", tags=["Providers"])

NO_LISTING = "No listing is linked to your account."


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
