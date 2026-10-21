"""Public listing detail; staff list, read, create and edit listings.

HTTP only: the rules are in services/listing_service.py (public), services/staff_listing_service.py (staff).
Contract: specs/backend/api-spec.md, "GET /listings/{slug}" and section 5.
"""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import NO_PERMISSION_MESSAGE, get_current_moment, get_session, require_role
from app.models import User
from app.models.base import Role
from app.schemas.listing import ListingDetail
from app.schemas.staff_listing import (
    ListingCreate,
    ListingUpdate,
    StaffListingDetail,
    StaffListingList,
    StaffListParams,
)
from app.services import access_service, listing_service, staff_listing_service
from app.services.listing_service import ListingNotFoundError

router = APIRouter(prefix="/listings", tags=["Listings"])

STAFF_ROLES = (Role.verifier, Role.editor, Role.admin)


@router.get("", response_model=StaffListingList, summary="Staff: the listings of every status")
async def list_listings(
    params: Annotated[StaffListParams, Query()],
    user: User = Depends(require_role(*STAFF_ROLES)),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> StaffListingList:
    return await staff_listing_service.list_listings(session, user, params, moment)


@router.get(
    "/id/{listing_id}",
    response_model=StaffListingDetail,
    summary="Staff: one listing of any status",
    responses={404: {"description": "No listing has this id."}},
)
async def get_listing_for_staff(
    listing_id: int,
    _user: User = Depends(require_role(*STAFF_ROLES)),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> StaffListingDetail:
    try:
        return await staff_listing_service.get_staff_detail(session, listing_id, moment)
    except staff_listing_service.ListingNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Listing not found") from None


@router.post(
    "",
    response_model=StaffListingDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Staff: create a draft listing",
)
async def create_listing(
    payload: ListingCreate,
    user: User = Depends(require_role(*STAFF_ROLES)),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> StaffListingDetail:
    try:
        listing_id = await staff_listing_service.create_listing(session, user, payload, moment)
    except staff_listing_service.UnknownCategoryError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "category: no such category") from None
    return await staff_listing_service.get_staff_detail(session, listing_id, moment)


@router.patch(
    "/{listing_id}",
    response_model=StaffListingDetail,
    summary="Staff: edit a listing",
    responses={
        403: {"description": "This role may not edit this listing (a verifier edits only their own drafts)."},
        404: {"description": "No listing has this id."},
    },
)
async def update_listing(
    listing_id: int,
    payload: ListingUpdate,
    user: User = Depends(require_role(*STAFF_ROLES)),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> StaffListingDetail:
    try:
        listing = await access_service.load_listing_for_editing(session, user, listing_id)
        await staff_listing_service.update_listing(session, user, listing, payload, moment)
    except access_service.ListingNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Listing not found") from None
    except access_service.NotAllowedError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, NO_PERMISSION_MESSAGE) from None
    except staff_listing_service.UnknownCategoryError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "category: no such category") from None
    return await staff_listing_service.get_staff_detail(session, listing_id, moment)


@router.get(
    "/{slug}",
    response_model=ListingDetail,
    summary="One published listing, for its page",
    responses={404: {"description": "No listing has this slug, or it is not published."}},
)
async def get_listing(
    slug: str,
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> ListingDetail:
    try:
        return await listing_service.get_published_listing(session, slug, moment)
    except ListingNotFoundError:
        # The same answer for a missing slug and an unpublished listing: nothing leaks about drafts.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Listing not found") from None
