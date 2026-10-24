"""The authenticator app of the logged-in person (FR-58).
HTTP only: the rules are in services/two_factor_service.py. Contract: specs/backend/api-spec.md, section 4b.
Every route needs a login (and so a ready account); the id of the account is never in the request, so nobody
can set up, switch off or read another person's app."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment, get_current_user, get_session, login_rate_limit
from app.api.limit_errors import too_many_wrong_codes
from app.models import User
from app.schemas.two_factor import (
    BackupCodesResponse,
    ConfirmRequest,
    EnabledResponse,
    PasswordAndCodeRequest,
    StartRequest,
    StartResponse,
    TwoFactorStatusRead,
)
from app.services import two_factor_service as service

router = APIRouter(prefix="/account/two-factor", tags=["Two-factor"])

NOT_AVAILABLE = "The authenticator app is not available yet."
WRONG_PASSWORD = "The password is not right."
WRONG_CODE = "That code is not right. Check that your phone's time is set automatically."
ALREADY_ON = "The authenticator app is already switched on."
NOT_ON = "The authenticator app is not switched on."
NOTHING_STARTED = "Start the set-up first."


def _problem(error: Exception) -> HTTPException:
    """Turns the service's domain errors into the answers of this feature."""
    if isinstance(error, service.TwoFactorUnavailableError):
        return HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, NOT_AVAILABLE)
    if isinstance(error, service.WrongPasswordError):
        return HTTPException(status.HTTP_403_FORBIDDEN, WRONG_PASSWORD)  # not 401: that means "log in again"
    if isinstance(error, service.WrongCodeError):
        return HTTPException(status.HTTP_400_BAD_REQUEST, WRONG_CODE)
    if isinstance(error, service.LockedError):
        return too_many_wrong_codes(error.seconds_left)
    if isinstance(error, service.AlreadyOnError):
        return HTTPException(status.HTTP_409_CONFLICT, ALREADY_ON)
    if isinstance(error, service.NotOnError):
        return HTTPException(status.HTTP_400_BAD_REQUEST, NOT_ON)
    if isinstance(error, service.NothingStartedError):
        return HTTPException(status.HTTP_400_BAD_REQUEST, NOTHING_STARTED)
    raise error


EXPECTED = (
    service.TwoFactorUnavailableError,
    service.WrongPasswordError,
    service.WrongCodeError,
    service.LockedError,
    service.AlreadyOnError,
    service.NotOnError,
    service.NothingStartedError,
)


@router.get("", response_model=TwoFactorStatusRead, summary="Is the authenticator app on for me?")
async def read_status(user: User = Depends(get_current_user)) -> TwoFactorStatusRead:
    current = service.status_of(user)
    return TwoFactorStatusRead(
        enabled=current.enabled, backup_codes_left=current.backup_codes_left, available=current.available
    )


@router.post(
    "/start",
    response_model=StartResponse,
    dependencies=[Depends(login_rate_limit)],
    summary="Start the set-up: password again, then the secret and the QR address (shown once)",
)
async def start_setup(
    request: StartRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> StartResponse:
    try:
        started = await service.start_setup(session, user, request.password)
    except EXPECTED as error:
        raise _problem(error) from None
    return StartResponse(secret=started.secret, otpauth_uri=started.otpauth_uri)


@router.post(
    "/confirm",
    response_model=BackupCodesResponse,
    summary="Finish the set-up with the first code from the app; the ten backup codes are shown once",
)
async def confirm_setup(
    request: ConfirmRequest,
    user: User = Depends(get_current_user),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> BackupCodesResponse:
    try:
        codes = await service.confirm_setup(session, user, request.code, moment)
    except EXPECTED as error:
        raise _problem(error) from None
    return BackupCodesResponse(backup_codes=codes)


@router.post(
    "/disable",
    response_model=EnabledResponse,
    dependencies=[Depends(login_rate_limit)],
    summary="Switch the app off: password and a code (from the app or a backup code)",
)
async def disable(
    request: PasswordAndCodeRequest,
    user: User = Depends(get_current_user),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> EnabledResponse:
    try:
        await service.disable(session, user, request.password, request.code, moment)
    except EXPECTED as error:
        raise _problem(error) from None
    return EnabledResponse(enabled=False)


@router.post(
    "/backup-codes",
    response_model=BackupCodesResponse,
    dependencies=[Depends(login_rate_limit)],
    summary="Ten new backup codes (the old ones stop working): password and a code",
)
async def new_backup_codes(
    request: PasswordAndCodeRequest,
    user: User = Depends(get_current_user),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> BackupCodesResponse:
    try:
        codes = await service.renew_backup_codes(session, user, request.password, request.code, moment)
    except EXPECTED as error:
        raise _problem(error) from None
    return BackupCodesResponse(backup_codes=codes)
