"""Shared FastAPI dependencies used by routes (session, current user, role checks, rate limits).

TODO: get_current_user (reads the Bearer token) and require_role(...) for role checks.
"""
from collections.abc import Awaitable, Callable

from fastapi import HTTPException, Request, status

from app.core.config import settings
from app.core.database import get_session
from app.core.rate_limit import RateLimiter, get_client_ip, login_limiter, verify_code_limiter

__all__ = ["get_session", "login_rate_limit", "verify_code_rate_limit"]


def build_rate_limit_dependency(limiter: RateLimiter) -> Callable[[Request], Awaitable[None]]:
    """Makes a FastAPI dependency that answers 429 when the client is over the limit (FR-30, NFR-06).

    It is `async def` without any `await`, so it runs on the event loop: two requests can never
    update the counters at the same time (a plain `def` dependency would run in a thread).
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
