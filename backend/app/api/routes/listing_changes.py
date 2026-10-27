"""Moving and closing a facility, and its address history. HTTP only: the rules are in
services/listing_change_service.py and who may do what is services/access_service.py.
Contract: specs/backend/api-spec.md, section 7, "Phase 8a" (FR-53, US-20).
"""

from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import NO_PERMISSION_MESSAGE, get_current_moment, get_session, require_role
from app.models import Listing, User
from app.models.base import Role
from app.repositories import listing_repository
from app.schemas.listing_change import AddressHistory, CloseResult, ListingClose, ListingMove, MoveResult
from app.services import access_service, listing_change_service, staff_alert_service

router = APIRouter(prefix="/listings", tags=["Listings"])

NOT_FOUND = "Listing not found"
MOVERS = (Role.editor, Role.admin, Role.provider)
READERS = (Role.verifier, Role.editor, Role.admin, Role.provider)


async def _listing_or_404(session: AsyncSession, listing_id: int) -> Listing:
    listing = await listing_repository.get_by_id(session, listing_id)
    if listing is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)
    return listing


@router.post(
    "/{listing_id}/move",
    response_model=MoveResult,
    summary="Move a facility to a new address (editor, admin, or an approved owner or manager)",
    responses={
        400: {"description": "Nothing changed, or the listing is closed."},
        403: {"description": "This account may not move this listing."},
        404: {"description": "No listing has this id."},
    },
)
async def move_listing(
    listing_id: int,
    payload: ListingMove,
    background_tasks: BackgroundTasks,
    user: User = Depends(require_role(*MOVERS)),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> MoveResult:
    listing = await _listing_or_404(session, listing_id)
    try:
        await access_service.ensure_can_edit(session, user, listing)
        outcome = await listing_change_service.move_listing(session, user, listing, payload, moment)
    except access_service.NotAllowedError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, NO_PERMISSION_MESSAGE) from None
    except listing_change_service.ClosedListingError:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "A closed listing cannot be moved. Reopen it first."
        ) from None
    except listing_change_service.NothingChangedError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nothing changed.") from None
    if outcome.alert is not None:
        # After the answer is sent: a slow email must not make the owner wait.
        background_tasks.add_task(staff_alert_service.send_alerts, outcome.alert)
    return outcome.result


@router.post(
    "/{listing_id}/close",
    response_model=CloseResult,
    summary="Close a facility: hidden for good, nothing deleted (editor, admin, or an approved owner)",
    responses={
        400: {"description": "The listing is closed already."},
        403: {"description": "This account may not close this listing (a manager may not)."},
        404: {"description": "No listing has this id."},
    },
)
async def close_listing(
    listing_id: int,
    payload: ListingClose,
    background_tasks: BackgroundTasks,
    user: User = Depends(require_role(*MOVERS)),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> CloseResult:
    listing = await _listing_or_404(session, listing_id)
    try:
        await access_service.ensure_can_close(session, user, listing)
        outcome = await listing_change_service.close_listing(session, user, listing, payload, moment)
    except access_service.NotAllowedError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, NO_PERMISSION_MESSAGE) from None
    except listing_change_service.AlreadyClosedError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This listing is already closed.") from None
    if outcome.alert is not None:
        background_tasks.add_task(staff_alert_service.send_alerts, outcome.alert)
    return outcome.result


@router.get(
    "/{listing_id}/address-history",
    response_model=AddressHistory,
    summary="The changes of a facility's address, newest first (staff, or an approved owner or manager)",
    responses={
        403: {"description": "This account may not read this listing's history."},
        404: {"description": "No listing has this id."},
    },
)
async def get_address_history(
    listing_id: int,
    user: User = Depends(require_role(*READERS)),
    session: AsyncSession = Depends(get_session),
) -> AddressHistory:
    listing = await _listing_or_404(session, listing_id)
    try:
        await access_service.ensure_can_read_history(session, user, listing)
    except access_service.NotAllowedError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, NO_PERMISSION_MESSAGE) from None
    return await listing_change_service.address_history(session, user, listing)
