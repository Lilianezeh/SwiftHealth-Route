"""In-memory rate limiting per client IP. Requirements: FR-30 (login and code), NFR-06 (rate limiting).

The counters live in this process only: they reset on restart and are not shared between instances.
That is fine for one Render instance (see decision 6 in the auth requirements).
"""
import time
from collections.abc import Callable
from datetime import timedelta

from fastapi import Request

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


def get_client_ip(request: Request, trusted_proxy_count: int) -> str:
    """The client address recorded by our own proxies, else the socket address, else "unknown".

    Every proxy in front of the API appends the address it received the request from to X-Forwarded-For.
    A client can send its own X-Forwarded-For too, and that text stays at the start of the list, so the first
    entry cannot be trusted. We count from the end instead: with one proxy the last entry is the client, with
    two proxies it is the second from the end, and so on. `trusted_proxy_count` must be at least 1.
    """
    header = request.headers.get("x-forwarded-for", "")
    entries = [entry.strip() for entry in header.split(",") if entry.strip()]
    if len(entries) >= trusted_proxy_count:
        return entries[-trusted_proxy_count]
    if request.client:
        return request.client.host
    return "unknown"


# One limiter per endpoint, so the two counters are separate. The dependencies that use them are in
# api/dependencies.py, because answering 429 is HTTP work.
login_limiter = RateLimiter(MAX_CALLS, WINDOW)
verify_code_limiter = RateLimiter(MAX_CALLS, WINDOW)
# The public report form (NFR-06, api-spec "POST /reports"): 5 reports per client IP per hour.
REPORT_MAX_CALLS = 5
REPORT_WINDOW = timedelta(hours=1)
report_limiter = RateLimiter(REPORT_MAX_CALLS, REPORT_WINDOW)
# The public "List your facility" form (FR-37, decision C7): 3 submissions per client IP per day.
SUBMISSION_MAX_CALLS = 3
SUBMISSION_WINDOW = timedelta(days=1)
submission_limiter = RateLimiter(SUBMISSION_MAX_CALLS, SUBMISSION_WINDOW)
