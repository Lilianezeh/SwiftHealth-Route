"""The promises to a visitor stay true after accounts. Requirements: NFR-07, FR-23 (Privacy page), FR-02.
Accounts phase 9; requirements section 6, "Kept true", of specs/2026-10-23-accounts-and-facility-ownership/.

A visitor needs no account and no cookie: search, SwiftRescue, the blood banks, the filter lists and a
listing page answer 200 with no login and set no cookie, and a cookie or a token sent by mistake changes
nothing. The API sets no cookie anywhere (the login is a token in the browser tab). Every name and
number here is fictional.
"""

import re
from pathlib import Path

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from tests.factories import add_listing, get_or_add_category

pytestmark = pytest.mark.anyio

APP_FOLDER = Path(__file__).resolve().parents[2] / "app"
COOKIE_OR_TRACKING = (
    r"set_cookie|delete_cookie|Set-Cookie|SessionMiddleware|gtag|google-analytics|posthog|mixpanel"
)


@pytest.fixture
async def published(session: AsyncSession):
    ambulance = await get_or_add_category(session, "ambulance", "Ambulance")
    ambulance.is_emergency = True
    session.add(ambulance)
    listing = await add_listing(session, "Night Pharmacy", category_slug="pharmacy")
    await add_listing(session, "Rescue Ambulance", category_slug="ambulance")
    await session.commit()
    return listing


def public_paths(slug: str) -> list[str]:
    return [
        "/search", "/search?q=pharmacy", "/emergency", "/blood/banks", "/blood/donation-centres", "/meta",
        f"/listings/{slug}",
    ]


async def test_the_public_answers_need_no_login_and_set_no_cookie(
    client: AsyncClient, published
) -> None:
    for path in public_paths(published.slug):
        response = await client.get(path)
        assert response.status_code == 200, path
        assert "set-cookie" not in response.headers, path


async def test_a_cookie_or_a_bad_token_sent_by_a_visitor_changes_nothing(
    client: AsyncClient, published
) -> None:
    for path in public_paths(published.slug):
        plain = await client.get(path)
        with_cookie = await client.get(path, headers={"Cookie": "session=abc; token=xyz"})
        with_bad_token = await client.get(path, headers={"Authorization": "Bearer not.a.real.token"})
        assert with_cookie.status_code == with_bad_token.status_code == plain.status_code == 200, path
        assert with_cookie.json() == plain.json() == with_bad_token.json(), path
        assert "set-cookie" not in with_cookie.headers and "set-cookie" not in with_bad_token.headers


async def test_an_error_answer_sets_no_cookie_either(client: AsyncClient) -> None:
    response = await client.get("/listings/no-such-listing")
    assert response.status_code == 404
    assert "set-cookie" not in response.headers


def test_no_source_file_of_the_api_sets_a_cookie_or_loads_a_tracking_library() -> None:
    offenders = []
    for path in APP_FOLDER.rglob("*.py"):
        text = path.read_text(encoding="utf8")
        if re.search(COOKIE_OR_TRACKING, text):
            offenders.append(str(path.relative_to(APP_FOLDER)))
    assert offenders == []
