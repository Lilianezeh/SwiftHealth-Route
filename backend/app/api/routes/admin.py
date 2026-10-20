"""Staff and provider accounts (FR-41); CSV import and export come in phase 14. HTTP only: the rules are in
services/admin_user_service.py. See specs/backend/api-spec.md, section 11 (admin only)."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment, get_session, require_role
from app.models import User
from app.models.base import Role
from app.schemas.admin_user import AdminUserCreate, AdminUserList, AdminUserUpdate
from app.schemas.auth import UserRead
from app.services import admin_user_service

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/users", response_model=AdminUserList, summary="Admin: every staff and provider account")
async def list_users(
    _admin: User = Depends(require_role(Role.admin)), session: AsyncSession = Depends(get_session)
) -> AdminUserList:
    return await admin_user_service.list_users(session)


@router.post(
    "/users",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    summary="Admin: add a staff or provider account",
    responses={409: {"description": "Another user already has this email."}},
)
async def create_user(
    payload: AdminUserCreate,
    admin: User = Depends(require_role(Role.admin)),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> UserRead:
    try:
        return await admin_user_service.create_user(session, admin, payload, moment)
    except admin_user_service.EmailTakenError:
        raise HTTPException(status.HTTP_409_CONFLICT, "A user with this email already exists.") from None


@router.patch(
    "/users/{user_id}",
    response_model=UserRead,
    summary="Admin: change an account, or link a provider to a listing",
)
async def update_user(
    user_id: int,
    payload: AdminUserUpdate,
    admin: User = Depends(require_role(Role.admin)),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> UserRead:
    try:
        return await admin_user_service.update_user(session, admin, user_id, payload, moment)
    except admin_user_service.UserNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found") from None
    except admin_user_service.SelfLockoutError:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "You cannot deactivate yourself or give up your own admin role."
        ) from None
    except admin_user_service.NotAProviderError:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "listing_id: only a provider can be linked to a listing"
        ) from None
    except admin_user_service.ListingNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Listing not found") from None
    except admin_user_service.ListingAlreadyOwnedError:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "This listing already belongs to another user."
        ) from None
