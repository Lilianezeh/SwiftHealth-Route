"""Login, one-time code, current user (FR-30). HTTP only: the rules are in services/auth_service.py."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_user, get_session, login_rate_limit, verify_code_rate_limit
from app.core.config import settings
from app.models import User
from app.schemas.auth import LoginRequest, LoginResponse, TokenResponse, UserRead, VerifyCodeRequest
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["Auth"])

WRONG_LOGIN_MESSAGE = "Invalid email or password"  # the same text for an unknown email and a wrong password
DEACTIVATED_MESSAGE = "This account is deactivated."


@router.post("/login", response_model=LoginResponse, dependencies=[Depends(login_rate_limit)])
async def login(login_request: LoginRequest, session: AsyncSession = Depends(get_session)) -> LoginResponse:
    try:
        started = await auth_service.start_login(session, login_request.email, login_request.password)
    except auth_service.InvalidCredentialsError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, WRONG_LOGIN_MESSAGE) from None
    except auth_service.InactiveAccountError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, DEACTIVATED_MESSAGE) from None
    except auth_service.MissingPhoneError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This account has no phone number.") from None
    except auth_service.CodeNotSentError:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Could not send the code. Try again.") from None
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
    return TokenResponse(
        access_token=completed.access_token,
        expires_in=settings.jwt_minutes * 60,
        user=UserRead.model_validate(completed.user),
    )


@router.get("/me", response_model=UserRead)
async def read_current_user(user: User = Depends(get_current_user)) -> User:
    return user
