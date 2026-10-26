"""The staff queue of owner links: who asked to edit which facility, and the decisions. HTTP only: the
rules are in services/owner_link_service.py. Contract: specs/backend/api-spec.md section 7, "Phase 6a"
(FR-50, US-19). Editors and admins only; a verifier or a provider gets 403."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment, get_session, require_role
from app.models import User
from app.models.base import Role
from app.schemas.owner_link import ApproveLink, DecisionNote, LinkRead, QueueList
from app.services import owner_link_service as service

router = APIRouter(prefix="/staff/owner-requests", tags=["Staff"])

CONFLICT = {409: {"description": "The link is not in the right state for this decision."}}


def _problem(error: Exception) -> HTTPException:
    if isinstance(error, service.LinkNotFoundError):
        return HTTPException(status.HTTP_404_NOT_FOUND, "Request not found")
    if isinstance(error, service.LinkNotPendingError):
        return HTTPException(status.HTTP_409_CONFLICT, "This request is not waiting.")
    if isinstance(error, service.LinkNotApprovedError):
        return HTTPException(status.HTTP_409_CONFLICT, "This link is not approved.")
    raise error


EXPECTED = (service.LinkNotFoundError, service.LinkNotPendingError, service.LinkNotApprovedError)


@router.get("", response_model=QueueList, summary="Staff: the owner requests that wait for a phone call")
async def list_requests(
    _staff: User = Depends(require_role(Role.editor)),
    session: AsyncSession = Depends(get_session),
) -> QueueList:
    return await service.queue(session)


@router.post(
    "/{link_id}/approve",
    response_model=LinkRead,
    summary="Staff: approve after phoning the facility (the note says who was reached)",
    responses=CONFLICT,
)
async def approve_request(
    link_id: int,
    request: ApproveLink,
    staff: User = Depends(require_role(Role.editor)),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> LinkRead:
    try:
        link = await service.approve(session, staff, link_id, request.note, moment)
    except EXPECTED as error:
        raise _problem(error) from None
    return LinkRead.model_validate(link)


@router.post(
    "/{link_id}/reject",
    response_model=LinkRead,
    summary="Staff: reject a request that waits",
    responses=CONFLICT,
)
async def reject_request(
    link_id: int,
    request: DecisionNote | None = None,
    staff: User = Depends(require_role(Role.editor)),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> LinkRead:
    try:
        link = await service.reject(session, staff, link_id, request.note if request else None, moment)
    except EXPECTED as error:
        raise _problem(error) from None
    return LinkRead.model_validate(link)


@router.post(
    "/{link_id}/remove",
    response_model=LinkRead,
    summary="Staff: take an approved link away (the access ends at once)",
    responses=CONFLICT,
)
async def remove_link(
    link_id: int,
    request: DecisionNote | None = None,
    staff: User = Depends(require_role(Role.editor)),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> LinkRead:
    try:
        link = await service.remove(session, staff, link_id, request.note if request else None, moment)
    except EXPECTED as error:
        raise _problem(error) from None
    return LinkRead.model_validate(link)
