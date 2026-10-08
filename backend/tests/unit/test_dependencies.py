"""Tests for the rate-limit dependencies in api/dependencies.py. Requirements: FR-30, NFR-06."""
from datetime import timedelta

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.api.dependencies import build_rate_limit_dependency
from app.core.rate_limit import RateLimiter


def make_request(socket_ip: str) -> Request:
    return Request({"type": "http", "headers": [], "client": (socket_ip, 50000)})


@pytest.mark.anyio
async def test_dependency_raises_429_when_limit_reached():
    limiter = RateLimiter(max_calls=10, window=timedelta(minutes=15))
    dependency = build_rate_limit_dependency(limiter)
    request = make_request("1.1.1.1")
    for _ in range(10):
        await dependency(request)  # the first 10 calls pass without raising
    with pytest.raises(HTTPException) as error:
        await dependency(request)
    assert error.value.status_code == 429


@pytest.mark.anyio
async def test_dependency_counts_each_ip_separately():
    limiter = RateLimiter(max_calls=1, window=timedelta(minutes=15))
    dependency = build_rate_limit_dependency(limiter)
    await dependency(make_request("1.1.1.1"))
    await dependency(make_request("2.2.2.2"))  # a different IP is not blocked
    with pytest.raises(HTTPException):
        await dependency(make_request("1.1.1.1"))
