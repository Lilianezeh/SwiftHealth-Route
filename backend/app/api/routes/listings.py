"""Public listing detail; staff create, edit, publish, hide.

HTTP only: the rules are in services/listing_service.py.
Contract: specs/backend/api-spec.md, "GET /listings/{slug}".
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment, get_session
from app.schemas.listing import ListingDetail
from app.services import listing_service
from app.services.listing_service import ListingNotFoundError

router = APIRouter(prefix="/listings", tags=["Listings"])

# TODO: add the staff endpoints from specs/backend/api-spec.md (phase 10)


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
