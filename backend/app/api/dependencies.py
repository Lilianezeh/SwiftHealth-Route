"""Shared FastAPI dependencies used by routes (session, current user, role checks, rate limits)."""
from collections.abc import Awaitable, Callable
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.core.database import get_session
from app.core.rate_limit import (
    RateLimiter,
    branch_limiter,
    claim_limiter,
    claimable_search_limiter,
    forgot_ip_limiter,
    get_client_ip,
    login_limiter,
    report_limiter,
    signup_limiter,
    submission_limiter,
    verify_code_limiter,
)
from app.core.security import InvalidTokenError
from app.models import Listing, User
from app.models.base import Role
from app.services import access_service, auth_service

__all__ = [
    "NO_PERMISSION_MESSAGE", "branch_rate_limit", "claim_rate_limit", "claimable_search_rate_limit",
    "forgot_rate_limit",
    "get_current_moment", "get_current_user", "get_session",
    "login_rate_limit",
    "require_listing_access", "report_rate_limit", "require_role", "signup_rate_limit",
    "submission_rate_limit", "verify_code_rate_limit",
]

STAFF_ROLES = {Role.verifier, Role.editor, Role.admin}
NO_PERMISSION_MESSAGE = "You do not have permission for this."

# OAuth2PasswordBearer (FastAPI Tutorial, Security) only reads the "Authorization: Bearer <token>" header and
# answers 401 when it is missing. Our login is two JSON steps, so Swagger's Authorize button won't work.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/verify-code")


def get_current_moment() -> datetime:
    """The current time in UTC. The one place routes read the clock, so tests can replace it.

    Plain `def`: it reads the clock and waits for nothing."""
    return datetime.now(timezone.utc)


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
    except auth_service.AccountNotReadyError as error:
        raise HTTPException(status.HTTP_403_FORBIDDEN, error.message) from None


def require_role(*allowed_roles: Role) -> Callable[[User], User]:
    """Makes a dependency that lets only the listed roles through (403 for the others, 401 without a token).

    Admin also passes any check that lists a staff role, because admin can do everything an editor can.
    Plain `def`: it only compares roles already in memory (decision 11).
    """

    def check_role(user: User = Depends(get_current_user)) -> User:
        admin_passes = user.role == Role.admin and bool(STAFF_ROLES & set(allowed_roles))
        if user.role not in allowed_roles and not admin_passes:
            raise HTTPException(status.HTTP_403_FORBIDDEN, NO_PERMISSION_MESSAGE)
        return user

    return check_role


async def require_listing_access(
    listing_id: int, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)
) -> Listing:
    """For routes with a `listing_id` path parameter: 404 if there is no such listing, 403 if not allowed."""
    try:
        return await access_service.load_listing_for_editing(session, user, listing_id)
    except access_service.ListingNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Listing not found") from None
    except access_service.NotAllowedError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, NO_PERMISSION_MESSAGE) from None


def build_rate_limit_dependency(
    limiter: RateLimiter, detail: str = "Too many attempts. Try again in a few minutes."
) -> Callable[[Request], Awaitable[None]]:
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
                detail=detail,
            )

    return check_rate_limit


login_rate_limit = build_rate_limit_dependency(login_limiter)
verify_code_rate_limit = build_rate_limit_dependency(verify_code_limiter)
report_rate_limit = build_rate_limit_dependency(
    report_limiter, "You've sent several reports. Please try again later."
)
signup_rate_limit = build_rate_limit_dependency(
    signup_limiter, "You've tried to sign up several times. Please try again later."
)
submission_rate_limit = build_rate_limit_dependency(
    submission_limiter, "You've sent several submissions. Please try again tomorrow."
)
branch_rate_limit = build_rate_limit_dependency(
    branch_limiter, "You've added several branches. Please try again tomorrow."
)
claim_rate_limit = build_rate_limit_dependency(
    claim_limiter, "You've sent several requests. Please try again tomorrow."
)
claimable_search_rate_limit = build_rate_limit_dependency(
    claimable_search_limiter, "You've searched many times. Please try again later."
)
forgot_rate_limit = build_rate_limit_dependency(
    forgot_ip_limiter, "You've asked for several codes. Please try again later."
)
