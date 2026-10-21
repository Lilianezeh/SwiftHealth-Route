"""Verifier call and visit logs, and the status moves of a listing. HTTP only: the rules are in
services/check_service.py and services/listing_status_service.py.
See specs/backend/api-spec.md, section 5 and "Phase 10 clarifications" (FR-32, FR-33, FR-36, US-10)."""

from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import (
    NO_PERMISSION_MESSAGE,
    get_current_moment,
    get_session,
    require_role,
)
from app.models import Listing, User
from app.models.base import Role
from app.repositories import listing_repository
from app.schemas.staff_listing import StaffListingDetail
from app.schemas.verification import CheckCreate, CheckList, CheckRead, HideRequest
from app.services import (
    access_service,
    check_service,
    listing_status_service,
    staff_alert_service,
    staff_listing_service,
)

router = APIRouter(prefix="/listings", tags=["Verifications"])

STAFF_ROLES = (Role.verifier, Role.editor, Role.admin)
EDITOR_ROLES = (Role.editor, Role.admin)
NOT_FOUND = "Listing not found"


async def _listing_or_404(session: AsyncSession, listing_id: int) -> Listing:
    listing = await listing_repository.get_by_id(session, listing_id)
    if listing is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)
    return listing


@router.post("/{listing_id}/checks", response_model=CheckRead, status_code=status.HTTP_201_CREATED)
async def log_check(
    listing_id: int,
    payload: CheckCreate,
    background_tasks: BackgroundTasks,
    user: User = Depends(require_role(*STAFF_ROLES)),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> CheckRead:
    try:
        outcome = await check_service.log_check(session, user, listing_id, payload, moment)
    except check_service.ListingNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND) from None
    if outcome.alert is not None:
        # After the answer is sent: a slow email must not make the verifier wait or fail the check.
        background_tasks.add_task(staff_alert_service.send_alerts, outcome.alert)
    return outcome.check


@router.get("/{listing_id}/checks", response_model=CheckList)
async def list_checks(
    listing_id: int,
    _user: User = Depends(require_role(*STAFF_ROLES)),
    session: AsyncSession = Depends(get_session),
) -> CheckList:
    try:
        return await check_service.list_checks(session, listing_id)
    except check_service.ListingNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND) from None


@router.post("/{listing_id}/submit", response_model=StaffListingDetail)
async def submit_listing(
    listing_id: int,
    user: User = Depends(require_role(*STAFF_ROLES)),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> StaffListingDetail:
    try:
        listing = await access_service.load_listing_for_editing(session, user, listing_id)
        await listing_status_service.submit(session, user, listing, moment)
    except access_service.ListingNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND) from None
    except access_service.NotAllowedError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, NO_PERMISSION_MESSAGE) from None
    except listing_status_service.InvalidMoveError as error:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(error)) from None
    return await staff_listing_service.get_staff_detail(session, listing_id, moment)


@router.post("/{listing_id}/publish", response_model=StaffListingDetail)
async def publish_listing(
    listing_id: int,
    user: User = Depends(require_role(*EDITOR_ROLES)),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> StaffListingDetail:
    listing = await _listing_or_404(session, listing_id)
    try:
        await listing_status_service.publish(session, user, listing, moment)
    except listing_status_service.InvalidMoveError as error:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(error)) from None
    return await staff_listing_service.get_staff_detail(session, listing_id, moment)


@router.post("/{listing_id}/hide", response_model=StaffListingDetail)
async def hide_listing(
    listing_id: int,
    payload: HideRequest,
    user: User = Depends(require_role(*EDITOR_ROLES)),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> StaffListingDetail:
    listing = await _listing_or_404(session, listing_id)
    try:
        await listing_status_service.hide(session, user, listing, payload.reason, moment)
    except listing_status_service.InvalidMoveError as error:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(error)) from None
    return await staff_listing_service.get_staff_detail(session, listing_id, moment)


@router.post("/{listing_id}/reopen", response_model=StaffListingDetail)
async def reopen_listing(
    listing_id: int,
    user: User = Depends(require_role(*EDITOR_ROLES)),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> StaffListingDetail:
    listing = await _listing_or_404(session, listing_id)
    try:
        await listing_status_service.reopen(session, user, listing, moment)
    except listing_status_service.InvalidMoveError as error:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(error)) from None
    return await staff_listing_service.get_staff_detail(session, listing_id, moment)
