"""Staff and provider accounts (FR-41); CSV import and export come in phase 14. HTTP only: the rules are in
services/admin_user_service.py. See specs/backend/api-spec.md, section 11 (admin only)."""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment, get_session, require_role
from app.core.passwords import PasswordRuleError
from app.models import User
from app.models.base import Role
from app.schemas.admin_user import AdminUserCreate, AdminUserList, AdminUserUpdate
from app.schemas.auth import UserRead
from app.schemas.two_factor import EnabledResponse
from app.services import admin_user_service, csv_export_service, csv_import_service, two_factor_service

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
    except PasswordRuleError as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(error)) from None


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
    except PasswordRuleError as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(error)) from None
    except admin_user_service.NewPasswordNeededError:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "To make a provider staff, give a new password of at least 10 characters in the same request.",
        ) from None


@router.post(
    "/users/{user_id}/reset-two-factor",
    response_model=EnabledResponse,
    summary="Admin: clear another account's authenticator app and backup codes (lost phone)",
    responses={400: {"description": "An admin cannot reset their own: another admin must."}},
)
async def reset_two_factor(
    user_id: int,
    admin: User = Depends(require_role(Role.admin)),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> EnabledResponse:
    try:
        await two_factor_service.admin_reset(session, admin, user_id, moment)
    except two_factor_service.SelfResetError:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Another admin must reset your two-step login."
        ) from None
    except two_factor_service.UserNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found") from None
    return EnabledResponse(enabled=False)


class ImportRowError(BaseModel):
    row: int
    detail: str


class ImportResponse(BaseModel):
    created: int
    errors: list[ImportRowError]


@router.post(
    "/import",
    response_model=ImportResponse,
    summary="Admin: import listings from a CSV (the request body is the CSV text)",
    responses={
        413: {"description": "The file is over 1 MB."},
        415: {"description": "The Content-Type is not text/csv."},
        422: {"description": "The file cannot be read: a column is missing, over 500 rows, or not UTF-8."},
    },
)
async def import_listings(
    request: Request,
    admin: User = Depends(require_role(Role.admin)),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> ImportResponse:
    if not request.headers.get("content-type", "").lower().startswith("text/csv"):
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Send the file as text/csv.")
    body = await request.body()
    if len(body) > csv_import_service.MAX_BYTES:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "The file is over 1 MB.")
    try:
        text = body.decode("utf-8")
        result = await csv_import_service.import_listings(session, admin, text, moment)
    except UnicodeDecodeError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "The file must be UTF-8 text.") from None
    except csv_import_service.CsvFileError as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(error)) from None
    errors = [ImportRowError(row=error.row, detail=error.detail) for error in result.errors]
    return ImportResponse(created=result.created, errors=errors)


@router.get("/export", summary="Admin: export listings or verification checks as CSV")
async def export_csv(
    type: Annotated[csv_export_service.ExportType, Query(description="listings or checks")],  # noqa: A002 (the api-spec name)
    _admin: User = Depends(require_role(Role.admin)),
    session: AsyncSession = Depends(get_session),
) -> Response:
    text = await csv_export_service.export_csv(session, type)
    return Response(
        content=text,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{type.value}.csv"'},
    )
