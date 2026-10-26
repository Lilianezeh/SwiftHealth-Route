"""The three new SwiftRescue categories as the rest of the API sees them. Requirements: FR-15, FR-01, FR-37.

Feature specs/2026-10-22-swiftrescue-groups/. The categories come from the revision (run by hand on
the test database). Staff can pick them (GET /meta lists every category), the Filters sheet leaves
them out (is_emergency), and "List your facility" refuses them like every emergency category.
"""
from collections.abc import Iterator
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment
from app.main import app
from app.models import User
from app.models.base import Role
from tests.revision_loader import SWIFTRESCUE_GROUPS_REVISION_FILE_PATTERN as GROUPS
from tests.revision_loader import run_upgrade
from tests.staff_helpers import bearer_for

pytestmark = pytest.mark.anyio

NEW_SLUGS = ["disaster-flooding", "gbv-support", "mental-health-crisis"]
NOW = datetime(2026, 10, 22, 12, 0, tzinfo=timezone.utc)


@pytest.fixture
def clock() -> Iterator[None]:
    app.dependency_overrides[get_current_moment] = lambda: NOW
    yield
    app.dependency_overrides.pop(get_current_moment, None)


@pytest.fixture
async def migrated(session: AsyncSession) -> None:
    await run_upgrade(session)
    await run_upgrade(session, GROUPS)
    await session.commit()


async def test_meta_lists_the_new_categories_as_emergency_ones_with_their_names(
    client: AsyncClient, migrated: None
) -> None:
    body = (await client.get("/meta")).json()

    by_slug = {entry["slug"]: entry for entry in body["categories"]}
    assert by_slug["disaster-flooding"] == {
        "slug": "disaster-flooding", "name": "Disaster and flooding", "is_emergency": True,
    }
    assert by_slug["gbv-support"]["name"] == "Sexual and gender-based violence support"
    assert by_slug["mental-health-crisis"]["is_emergency"] is True
    assert by_slug["fire"]["name"] == "Fire service"  # the renamed rows show their new names


@pytest.mark.parametrize("slug", NEW_SLUGS)
async def test_list_your_facility_refuses_the_new_categories_like_every_emergency_category(
    client: AsyncClient, clock: None, migrated: None, demo_users: dict[Role, User], slug: str
) -> None:
    body = {
        "facility_name": "Example Support", "category": slug, "area": "GRA",
        "address": "4 Example Street", "phone": "08030000000",
    }

    response = await client.post(
        "/provider/facilities",
        json=body,
        headers={**bearer_for(demo_users[Role.provider]), "x-forwarded-for": "203.0.113.9"},
    )

    assert response.status_code == 422
