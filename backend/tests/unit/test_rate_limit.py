"""Tests for core/rate_limit.py. Requirements: FR-30 (login and one-time code), NFR-06 (rate limiting)."""
from datetime import timedelta

import anyio
import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.core.rate_limit import RateLimiter, build_rate_limit_dependency, get_client_ip

FIFTEEN_MINUTES = timedelta(minutes=15)


class FakeClock:
    """A clock the test moves by hand, so no test has to wait for real time to pass."""

    def __init__(self) -> None:
        self.now_seconds = 0.0

    def __call__(self) -> float:
        return self.now_seconds

    def move_forward(self, amount: timedelta) -> None:
        self.now_seconds += amount.total_seconds()


def make_limiter(clock: FakeClock) -> RateLimiter:
    return RateLimiter(max_calls=10, window=FIFTEEN_MINUTES, clock=clock)


def make_request(headers: dict[str, str] | None = None, socket_ip: str | None = "10.0.0.1") -> Request:
    """Builds a bare request with only what the limiter reads: the headers and the socket address."""
    raw_headers = [(name.lower().encode(), value.encode()) for name, value in (headers or {}).items()]
    client = (socket_ip, 50000) if socket_ip else None
    return Request({"type": "http", "headers": raw_headers, "client": client})


def test_allows_10_then_blocks_11th():
    limiter = make_limiter(FakeClock())
    results = [limiter.allow("1.1.1.1") for _ in range(11)]
    assert results == [True] * 10 + [False]


def test_window_expires_after_15_minutes():
    clock = FakeClock()
    limiter = make_limiter(clock)
    for _ in range(10):
        limiter.allow("1.1.1.1")
    clock.move_forward(FIFTEEN_MINUTES - timedelta(seconds=1))
    assert not limiter.allow("1.1.1.1")  # still inside the window
    clock.move_forward(timedelta(seconds=1))
    assert limiter.allow("1.1.1.1")  # the first 10 calls are now 15 minutes old


def test_ips_counted_separately():
    limiter = make_limiter(FakeClock())
    for _ in range(10):
        limiter.allow("1.1.1.1")
    assert not limiter.allow("1.1.1.1")
    assert limiter.allow("2.2.2.2")


def test_endpoints_counted_separately():
    # Each endpoint has its own RateLimiter, so using up /auth/login does not block /auth/verify-code.
    clock = FakeClock()
    login_limiter = make_limiter(clock)
    verify_code_limiter = make_limiter(clock)
    for _ in range(10):
        login_limiter.allow("1.1.1.1")
    assert not login_limiter.allow("1.1.1.1")
    assert verify_code_limiter.allow("1.1.1.1")


def test_reset_clears_all_counts():
    limiter = make_limiter(FakeClock())
    for _ in range(10):
        limiter.allow("1.1.1.1")
    limiter.reset()
    assert limiter.allow("1.1.1.1")


def test_client_ip_comes_from_x_forwarded_for():
    request = make_request({"X-Forwarded-For": "203.0.113.5, 10.1.1.1"}, socket_ip="10.0.0.1")
    assert get_client_ip(request) == "203.0.113.5"


def test_client_ip_falls_back_to_socket_address():
    assert get_client_ip(make_request(socket_ip="10.0.0.1")) == "10.0.0.1"


def test_client_ip_is_unknown_without_header_or_socket():
    assert get_client_ip(make_request(socket_ip=None)) == "unknown"


def test_dependency_raises_429_when_limit_reached():
    dependency = build_rate_limit_dependency(make_limiter(FakeClock()))
    request = make_request(socket_ip="1.1.1.1")
    for _ in range(10):
        anyio.run(dependency, request)  # the first 10 calls pass without raising
    with pytest.raises(HTTPException) as error:
        anyio.run(dependency, request)
    assert error.value.status_code == 429
