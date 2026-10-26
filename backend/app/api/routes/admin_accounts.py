"""The admin decides on accounts and reads the activity log. HTTP only: the rules are in
services/account_decision_service.py and services/activity_service.py.
Contract: specs/backend/api-spec.md section 11, "Phase 4a" (FR-49, FR-55, US-18). Every route is admin
only; the role is read from the database row. No route deletes an account."""

from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment, get_session, require_role
from app.models import User
from app.models.base import Role
from app.schemas.account_decision import ApproveRequest, RejectRequest, SuspendRequest
from app.schemas.activity import ActivityList
from app.schemas.admin_user import AdminUserRow
from app.services import account_decision_service as decisions
from app.services import activity_service

router = APIRouter(prefix="/admin", tags=["Admin"])

CONFLICT = {409: {"description": "The account is not in the right state for this decision."}}


def _problem(error: Exception) -> HTTPException:
    """Turns the service's domain errors into the answers of the decisions."""
    if isinstance(error, decisions.UserNotFoundError):
        return HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if isinstance(error, decisions.SelfLockoutError):
        return HTTPException(
            status.HTTP_400_BAD_REQUEST, "You cannot deactivate yourself or give up your own admin role."
        )
    conflicts = {
        decisions.NotPendingError: "This account is not waiting for approval.",
        decisions.EmailNotConfirmedError: "The email is not confirmed yet.",
        decisions.PhoneNotConfirmedError: (
            "Confirm the phone first: phone the person, then record 'phone confirmed by call'."
        ),
        decisions.AlreadySuspendedError: "This account is already suspended.",
        decisions.NotSuspendedError: "This account is not suspended.",
        decisions.ClosedAccountError: "This account is closed.",
        decisions.LastAdminError: "This is the last active admin.",
    }
    for error_type, sentence in conflicts.items():
        if isinstance(error, error_type):
            return HTTPException(status.HTTP_409_CONFLICT, sentence)
    raise error


EXPECTED = (
    decisions.UserNotFoundError,
    decisions.SelfLockoutError,
    decisions.NotPendingError,
    decisions.EmailNotConfirmedError,
    decisions.PhoneNotConfirmedError,
    decisions.AlreadySuspendedError,
    decisions.NotSuspendedError,
    decisions.ClosedAccountError,
    decisions.LastAdminError,
)


@router.post(
    "/users/{user_id}/approve",
    response_model=AdminUserRow,
    summary="Admin: approve a staff sign-up as an editor or a verifier",
    responses=CONFLICT,
)
async def approve_user(
    user_id: int,
    request: ApproveRequest,
    admin: User = Depends(require_role(Role.admin)),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> AdminUserRow:
    try:
        user = await decisions.approve(session, admin, user_id, Role(request.role), moment)
    except EXPECTED as error:
        raise _problem(error) from None
    return AdminUserRow.model_validate(user)


@router.post(
    "/users/{user_id}/reject",
    response_model=AdminUserRow,
    summary="Admin: reject a staff sign-up (the person can never log in)",
    responses=CONFLICT,
)
async def reject_user(
    user_id: int,
    request: RejectRequest | None = None,
    admin: User = Depends(require_role(Role.admin)),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> AdminUserRow:
    reason = request.reason if request is not None else None
    try:
        user = await decisions.reject(session, admin, user_id, reason, moment)
    except EXPECTED as error:
        raise _problem(error) from None
    return AdminUserRow.model_validate(user)


@router.post(
    "/users/{user_id}/suspend",
    response_model=AdminUserRow,
    summary="Admin: suspend an account (refused on its next request); never yourself, never the last admin",
    responses={**CONFLICT, 400: {"description": "An admin cannot suspend themselves."}},
)
async def suspend_user(
    user_id: int,
    request: SuspendRequest,
    admin: User = Depends(require_role(Role.admin)),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> AdminUserRow:
    try:
        user = await decisions.suspend(session, admin.id, user_id, request.reason, moment)
    except EXPECTED as error:
        raise _problem(error) from None
    return AdminUserRow.model_validate(user)


@router.post(
    "/users/{user_id}/reactivate",
    response_model=AdminUserRow,
    summary="Admin: turn a suspended account back on (not a rejected or closed one)",
    responses=CONFLICT,
)
async def reactivate_user(
    user_id: int,
    admin: User = Depends(require_role(Role.admin)),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> AdminUserRow:
    try:
        user = await decisions.reactivate(session, admin, user_id, moment)
    except EXPECTED as error:
        raise _problem(error) from None
    return AdminUserRow.model_validate(user)


@router.get(
    "/activity",
    response_model=ActivityList,
    summary="Admin: the activity log, newest first (who did what and when)",
)
async def activity(
    user_id: int | None = Query(default=None, description="Only what this person did."),
    action: str | None = Query(
        default=None, max_length=100, description="Only this action, exactly (user_approve)."
    ),
    first_day: date | None = Query(
        default=None, alias="from", description="From this day, included (YYYY-MM-DD, Lagos)."
    ),
    last_day: date | None = Query(
        default=None, alias="to", description="To this day, included (YYYY-MM-DD, Lagos)."
    ),
    limit: int = Query(default=50, ge=1, le=200, description="Page size."),
    offset: int = Query(default=0, ge=0),
    _admin: User = Depends(require_role(Role.admin)),
    session: AsyncSession = Depends(get_session),
) -> ActivityList:
    return await activity_service.list_activity(
        session,
        user_id=user_id,
        action=action,
        first_day=first_day,
        last_day=last_day,
        limit=limit,
        offset=offset,
    )
