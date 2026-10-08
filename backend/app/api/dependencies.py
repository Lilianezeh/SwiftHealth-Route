"""Shared FastAPI dependencies used by routes (session, current user, role checks, rate limits).

TODO: require_role(...) for role checks (auth Task 5).
"""
from collections.abc import Awaitable, Callable

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.core.database import get_session
from app.core.rate_limit import RateLimiter, get_client_ip, login_limiter, verify_code_limiter
from app.core.security import InvalidTokenError
from app.models import User
from app.services import auth_service

__all__ = ["get_current_user", "get_session", "login_rate_limit", "verify_code_rate_limit"]

# OAuth2PasswordBearer (FastAPI Tutorial, Security) only reads the "Authorization: Bearer <token>" header and
# answers 401 when it is missing. Our login is two JSON steps, so Swagger's Authorize button won't work.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/verify-code")


async def get_current_user(
    access_token: str = Depends(oauth2_scheme), session: AsyncSession = Depends(get_session)
) -> User:
    """The logged-in user, loaded from the database on every request (the token holds no role)."""
    try:
        return await auth_service.get_user_for_token(session, access_token)
    except InvalidTokenError:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Invalid or expired token", headers={"WWW-Authenticate": "Bearer"}
        ) from None
    except auth_service.InactiveAccountError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account is deactivated.") from None


def build_rate_limit_dependency(limiter: RateLimiter) -> Callable[[Request], Awaitable[None]]:
    """Makes a FastAPI dependency that answers 429 when the client is over the limit (FR-30, NFR-06).

    It waits for nothing, but it is `async def` on purpose (the documented exception in decision 11): FastAPI
    runs `async def` dependencies on the event loop, so two requests can never update the limiter's counters
    at the same time. A plain `def` dependency would run in a thread and could race.
    """

    async def check_rate_limit(request: Request) -> None:
        client_ip = get_client_ip(request, settings.trusted_proxy_count)
        if not limiter.allow(client_ip):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many attempts. Try again in a few minutes.",
            )

    return check_rate_limit


login_rate_limit = build_rate_limit_dependency(login_limiter)
verify_code_rate_limit = build_rate_limit_dependency(verify_code_limiter)
