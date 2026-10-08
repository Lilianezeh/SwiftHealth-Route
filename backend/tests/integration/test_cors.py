"""Tests for the CORS settings in app/main.py. Requirements: NFR-06 (only our own site may call the API).

The app reads CORS_ORIGINS once at start-up, so these tests use the origin the app was built with.
"""
import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.main import app

ALLOWED_ORIGIN = settings.cors_origin_list[0]
UNKNOWN_ORIGIN = "https://not-swifthealth.example.com"


async def preflight(origin: str):
    """The browser's "may I call this?" request, sent before a call from another site."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as test_client:
        return await test_client.options(
            "/health", headers={"Origin": origin, "Access-Control-Request-Method": "GET"}
        )


@pytest.mark.anyio
async def test_cors_allows_the_configured_origin():
    response = await preflight(ALLOWED_ORIGIN)
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN


@pytest.mark.anyio
async def test_cors_does_not_allow_an_unknown_origin():
    response = await preflight(UNKNOWN_ORIGIN)
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


@pytest.mark.anyio
async def test_a_normal_request_from_an_unknown_origin_gets_no_cors_header():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as test_client:
        response = await test_client.get("/health", headers={"Origin": UNKNOWN_ORIGIN})
    assert "access-control-allow-origin" not in response.headers
