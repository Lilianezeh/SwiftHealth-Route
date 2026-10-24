"""Login, one-time code, current user (FR-30, FR-57). HTTP only: the rules are in services/auth_service.py."""
import math
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
from app.core.config import settings
from app.models import User
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    ResendCodeRequest,
    TokenResponse,
    UserRead,
    VerifyCodeRequest,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["Auth"])

WRONG_LOGIN_MESSAGE = "Invalid email or password"  # the same text for an unknown email and a wrong password
DEACTIVATED_MESSAGE = "This account is deactivated."
SMS_NOT_SENT_MESSAGE = "Could not send the code. Try again."


def _plural(count: int, word: str) -> str:
    return f"{count} {word}" if count == 1 else f"{count} {word}s"


def too_soon(error: auth_service.CodeTooSoonError) -> HTTPException:
    """429 for a new code within 60 seconds of the last: a sentence, and `Retry-After` in seconds."""
    return HTTPException(
        status.HTTP_429_TOO_MANY_REQUESTS,
        f"Wait {_plural(error.seconds_left, 'second')} before asking for a new code.",
        headers={"Retry-After": str(error.seconds_left)},
    )


def too_many_codes(error: auth_service.TooManyCodesError) -> HTTPException:
    """429 for the sixth code in an hour: the sentence says minutes, `Retry-After` says seconds."""
    minutes = math.ceil(error.seconds_left / 60)
    return HTTPException(
        status.HTTP_429_TOO_MANY_REQUESTS,
        f"Too many codes. Try again in {_plural(minutes, 'minute')}.",
        headers={"Retry-After": str(error.seconds_left)},
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
        raise too_many_codes(error) from None
    except auth_service.CodeNotSentError:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, SMS_NOT_SENT_MESSAGE) from None
    return LoginResponse(challenge_token=started.challenge_token, sent_to=started.sent_to)


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
        raise too_soon(error) from None
    except auth_service.TooManyCodesError as error:
        raise too_many_codes(error) from None
    except auth_service.CodeNotSentError:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, SMS_NOT_SENT_MESSAGE) from None
    return LoginResponse(challenge_token=started.challenge_token, sent_to=started.sent_to)


@router.post("/verify-code", response_model=TokenResponse, dependencies=[Depends(verify_code_rate_limit)])
async def verify_code(
    verify_request: VerifyCodeRequest, session: AsyncSession = Depends(get_session)
) -> TokenResponse:
    try:
        completed = await auth_service.verify_login_code(
            session, verify_request.challenge_token, verify_request.code
        )
    except auth_service.InvalidCodeError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired code") from None
    except auth_service.InactiveAccountError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, DEACTIVATED_MESSAGE) from None
    except auth_service.AccountNotReadyError as error:
        raise HTTPException(status.HTTP_403_FORBIDDEN, error.message) from None
    return TokenResponse(
        access_token=completed.access_token,
        expires_in=settings.jwt_minutes * 60,
        user=UserRead.model_validate(completed.user),
    )


@router.get("/me", response_model=UserRead)
async def read_current_user(user: User = Depends(get_current_user)) -> User:
    return user
