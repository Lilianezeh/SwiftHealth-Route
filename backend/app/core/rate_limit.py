"""In-memory rate limiting per client IP. Requirements: FR-30 (login and code), NFR-06 (rate limiting).

The counters live in this process only: they reset on restart and are not shared between instances.
That is fine for one Render instance (see decision 6 in the auth requirements).
"""
import math
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

    def retry_after_seconds(self, key: str) -> int:
        """Whole seconds until `key` may call again: 0 when under the limit. Asking counts as no call."""
        now = self.clock()
        recent_call_times = [
            call_time
            for call_time in self.call_times_by_ip.get(key, [])
            if now - call_time < self.window_seconds
        ]
        if len(recent_call_times) < self.max_calls:
            return 0
        oldest_that_counts = recent_call_times[len(recent_call_times) - self.max_calls]
        return math.ceil(oldest_that_counts + self.window_seconds - now)

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
# Every login SMS costs money (FR-57): at most 5 codes per account per hour, the first one included. The
# key is "sms:<user id>", not an address, so it follows the account. A cost limit, not a security control:
# it is forgotten when the API restarts, like the other counters.
SMS_CODES_PER_HOUR = 5
sms_code_limiter = RateLimiter(SMS_CODES_PER_HOUR, timedelta(hours=1))  # also counts the codes sent by email
# Wrong second-step codes (app or backup) per account: after 10 in an hour the second step is locked for the
# rest of the hour (FR-58). The key is "totp:<user id>". Kept in memory like the others.
WRONG_APP_CODES_PER_HOUR = 10
totp_failure_limiter = RateLimiter(WRONG_APP_CODES_PER_HOUR, timedelta(hours=1))
# Sign-up (FR-48): 10 attempts per client address per hour, 3 per email per hour (an existing email counts
# too, so the limit says nothing about who has an account), and 10 wrong codes per account per hour. In
# memory, like the others.
signup_limiter = RateLimiter(10, timedelta(hours=1))
signup_email_limiter = RateLimiter(3, timedelta(hours=1))
signup_code_failure_limiter = RateLimiter(10, timedelta(hours=1))
# Account self-service (FR-54, Phase 5): "I forgot my password" is 3 an hour per email (an unknown email
# counts too, so the limit says nothing about who has an account) and 10 an hour per client address; a
# wrong current password is 10 per 15 minutes per account. The wrong codes of a new email, a new phone or
# a reset use `signup_code_failure_limiter`
# (10 an hour), with the keys "account:<id>" and "reset:<id>". In memory, like the others.
forgot_email_limiter = RateLimiter(3, timedelta(hours=1))
forgot_ip_limiter = RateLimiter(10, timedelta(hours=1))
password_failure_limiter = RateLimiter(10, timedelta(minutes=15))
# The public report form (NFR-06, api-spec "POST /reports"): 5 reports per client IP per hour.
REPORT_MAX_CALLS = 5
REPORT_WINDOW = timedelta(hours=1)
report_limiter = RateLimiter(REPORT_MAX_CALLS, REPORT_WINDOW)
# The public "List your facility" form (FR-37, decision C7): 3 submissions per client IP per day.
SUBMISSION_MAX_CALLS = 3
SUBMISSION_WINDOW = timedelta(days=1)
submission_limiter = RateLimiter(SUBMISSION_MAX_CALLS, SUBMISSION_WINDOW)
# Claiming an existing listing (FR-50, Phase 7): 10 claims per client address per day, and 60 searches in the
# claim search per client address per hour. In memory, like the others.
claim_limiter = RateLimiter(10, timedelta(days=1))
claimable_search_limiter = RateLimiter(60, timedelta(hours=1))
# Adding a branch to a facility (FR-52, Phase 8b): 10 per client address per day.
branch_limiter = RateLimiter(10, timedelta(days=1))
