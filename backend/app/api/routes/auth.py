"""Login, one-time code, current user (FR-30, FR-57, FR-58).
HTTP only: the rules are in services/auth_service.py."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import (
    get_current_moment,
    get_current_user,
    get_session,
    login_rate_limit,
    verify_code_rate_limit,
)
from app.api.limit_errors import code_too_soon, too_many_codes, too_many_wrong_codes
from app.core.config import settings
from app.models import User
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    ResendCodeRequest,
    TokenResponse,
    UserRead,
    UseSmsRequest,
    VerifyCodeRequest,
)
from app.services import auth_service, two_factor_service

router = APIRouter(prefix="/auth", tags=["Auth"])

WRONG_LOGIN_MESSAGE = "Invalid email or password"  # the same text for an unknown email and a wrong password
DEACTIVATED_MESSAGE = "This account is deactivated."
SMS_NOT_SENT_MESSAGE = "Could not send the code. Try again."
APP_CODE_UNAVAILABLE_MESSAGE = "Codes from the app cannot be checked right now. Use a backup code."


def _login_response(started: auth_service.LoginStarted) -> LoginResponse:
    return LoginResponse(
        challenge_token=started.challenge_token,
        sent_to=started.sent_to,
        method=started.method,
        can_use_sms=started.can_use_sms,
    )


@router.post("/login", response_model=LoginResponse, dependencies=[Depends(login_rate_limit)])
async def login(
    login_request: LoginRequest,
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> LoginResponse:
    try:
        started = await auth_service.start_login(session, login_request.email, login_request.password, moment)
    except auth_service.InvalidCredentialsError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, WRONG_LOGIN_MESSAGE) from None
    except auth_service.InactiveAccountError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, DEACTIVATED_MESSAGE) from None
    except auth_service.AccountNotReadyError as error:
        raise HTTPException(status.HTTP_403_FORBIDDEN, error.message) from None
    except auth_service.MissingPhoneError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This account has no phone number.") from None
    except auth_service.TooManyCodesError as error:
        raise too_many_codes(error.seconds_left) from None
    except auth_service.CodeNotSentError:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, SMS_NOT_SENT_MESSAGE) from None
    return _login_response(started)


@router.post(
    "/resend-code",
    response_model=LoginResponse,
    dependencies=[Depends(login_rate_limit)],
    summary="Ask for a new login code, without sending the password again",
    responses={429: {"description": "Under 60 s since the last code, or 5 codes in an hour (Retry-After)."}},
)
async def resend_code(
    resend_request: ResendCodeRequest,
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> LoginResponse:
    try:
        started = await auth_service.resend_login_code(session, resend_request.challenge_token, moment)
    except auth_service.InvalidCodeError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired code") from None
    except auth_service.InactiveAccountError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, DEACTIVATED_MESSAGE) from None
    except auth_service.AccountNotReadyError as error:
        raise HTTPException(status.HTTP_403_FORBIDDEN, error.message) from None
    except auth_service.MissingPhoneError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This account has no phone number.") from None
    except auth_service.CodeTooSoonError as error:
        raise code_too_soon(error.seconds_left) from None
    except auth_service.TooManyCodesError as error:
        raise too_many_codes(error.seconds_left) from None
    except auth_service.CodeNotSentError:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, SMS_NOT_SENT_MESSAGE) from None
    return _login_response(started)


@router.post(
    "/use-sms",
    response_model=LoginResponse,
    dependencies=[Depends(login_rate_limit)],
    summary="With the authenticator app: ask for an SMS code instead (only when SMS is set up)",
    responses={409: {"description": "SMS is not available (Termii not set up, or phone not confirmed)."}},
)
async def use_sms(
    use_sms_request: UseSmsRequest,
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> LoginResponse:
    try:
        started = await auth_service.use_sms_instead(session, use_sms_request.challenge_token, moment)
    except auth_service.InvalidCodeError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired code") from None
    except auth_service.InactiveAccountError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, DEACTIVATED_MESSAGE) from None
    except auth_service.AccountNotReadyError as error:
        raise HTTPException(status.HTTP_403_FORBIDDEN, error.message) from None
    except auth_service.SmsNotAvailableError:
        raise HTTPException(status.HTTP_409_CONFLICT, "SMS codes are not available.") from None
    except auth_service.TooManyCodesError as error:
        raise too_many_codes(error.seconds_left) from None
    except auth_service.CodeNotSentError:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, SMS_NOT_SENT_MESSAGE) from None
    return _login_response(started)


@router.post("/verify-code", response_model=TokenResponse, dependencies=[Depends(verify_code_rate_limit)])
async def verify_code(
    verify_request: VerifyCodeRequest,
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> TokenResponse:
    try:
        completed = await auth_service.verify_login_code(
            session, verify_request.challenge_token, verify_request.code, moment
        )
    except auth_service.InvalidCodeError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired code") from None
    except auth_service.InactiveAccountError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, DEACTIVATED_MESSAGE) from None
    except auth_service.AccountNotReadyError as error:
        raise HTTPException(status.HTTP_403_FORBIDDEN, error.message) from None
    except two_factor_service.LockedError as error:
        raise too_many_wrong_codes(error.seconds_left) from None
    except two_factor_service.TwoFactorUnavailableError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, APP_CODE_UNAVAILABLE_MESSAGE) from None
    return TokenResponse(
        access_token=completed.access_token,
        expires_in=settings.jwt_minutes * 60,
        user=UserRead.model_validate(completed.user),
    )


@router.get("/me", response_model=UserRead)
async def read_current_user(user: User = Depends(get_current_user)) -> User:
    return user
