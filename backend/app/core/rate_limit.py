"""In-memory rate limiting per client IP. Requirements: FR-30 (login and code), NFR-06 (rate limiting).

The counters live in this process only: they reset on restart and are not shared between instances.
That is fine for one Render instance (see decision 6 in the auth requirements).
"""
import time
from collections.abc import Awaitable, Callable
from datetime import timedelta

from fastapi import HTTPException, Request, status

MAX_CALLS = 10
WINDOW = timedelta(minutes=15)


class RateLimiter:
    """Allows `max_calls` calls per client IP inside a sliding window of `window`."""

    def __init__(
        self,
        max_calls: int,
        window: timedelta,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.max_calls = max_calls
        self.window_seconds = window.total_seconds()
        self.clock = clock
        self.call_times_by_ip: dict[str, list[float]] = {}

    def allow(self, client_ip: str) -> bool:
        """Counts this call and returns True, or returns False when the client is over the limit.

        Blocked calls are not recorded, so a blocked client is free again 15 minutes after its
        10th allowed call.
        """
        now = self.clock()
        recent_call_times = [
            call_time
            for call_time in self.call_times_by_ip.get(client_ip, [])
            if now - call_time < self.window_seconds
        ]
        if len(recent_call_times) >= self.max_calls:
            self.call_times_by_ip[client_ip] = recent_call_times
            return False
        recent_call_times.append(now)
        self.call_times_by_ip[client_ip] = recent_call_times
        return True

    def reset(self) -> None:
        """Forgets every count. The test setup calls this between tests."""
        self.call_times_by_ip.clear()


def get_client_ip(request: Request) -> str:
    """The first X-Forwarded-For entry (Render sets it), else the socket address, else "unknown"."""
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def build_rate_limit_dependency(limiter: RateLimiter) -> Callable[[Request], Awaitable[None]]:
    """Makes a FastAPI dependency that answers 429 when the client is over the limit.

    It is `async def` without any `await`, so it runs on the event loop: two requests can never
    update the counters at the same time (a plain `def` dependency would run in a thread).
    """

    async def check_rate_limit(request: Request) -> None:
        if not limiter.allow(get_client_ip(request)):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many attempts. Try again in a few minutes.",
            )

    return check_rate_limit


# One limiter per endpoint, so the two counters are separate.
login_limiter = RateLimiter(MAX_CALLS, WINDOW)
verify_code_limiter = RateLimiter(MAX_CALLS, WINDOW)

login_rate_limit = build_rate_limit_dependency(login_limiter)
verify_code_rate_limit = build_rate_limit_dependency(verify_code_limiter)
