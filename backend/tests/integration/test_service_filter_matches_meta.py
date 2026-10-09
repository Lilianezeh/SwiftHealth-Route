"""/meta and the /search service filter must agree on what "the same service" is. Requirements: FR-05, US-05.

Decision 9 in specs/2026-10-09-meta-endpoint/requirements.md. The expected groups below are written out by
hand, so neither the Python rule nor the SQL rule is its own judge: if either drifts, a group here breaks.
"""
from collections.abc import Iterator
from datetime import datetime, timezone
from pathlib import Path

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment
from app.main import app
from tests.factories import add_listing

pytestmark = pytest.mark.anyio

# label shown by /meta -> every spelling saved in the database that it must stand for
GROUPS = {
    "Consultation": ["Consultation", "consultation", " Consultation  "],
    "Malaria test": ["Malaria test", "malaria  test", "Malaria   test"],
    "Malaria-test": ["Malaria-test"],  # the hyphen goes but a space stays: not the same as "Malaria test"
    "Pap smear": ["Pap smear"],
    "Ultrasound": ["Ultrasound", "ultrasound "],
    "X-ray": ["X-ray", "x-ray", " X-ray ", "Xray", "XRAY", "x--ray"],  # no "X-RAY": capitals sort first
}


@pytest.fixture
def clock() -> Iterator[None]:
    moment = datetime(2026, 10, 6, 9, 0, tzinfo=timezone.utc)
    app.dependency_overrides[get_current_moment] = lambda: moment
    yield
    app.dependency_overrides.pop(get_current_moment, None)


async def add_one_listing_per_spelling(session: AsyncSession) -> dict[str, set[str]]:
    """Returns, for every label, the names of the listings that hold one of its spellings."""
    listings_by_label: dict[str, set[str]] = {}
    number = 0
    for label, spellings in GROUPS.items():
        listings_by_label[label] = set()
        for spelling in spellings:
            number += 1
            name = f"Place {number:02d}"
            await add_listing(session, name, category_slug="laboratory", service_names=(spelling,))
            listings_by_label[label].add(name)
    await session.commit()
    return listings_by_label


async def test_every_meta_choice_finds_exactly_the_listings_whose_service_it_stands_for(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    listings_by_label = await add_one_listing_per_spelling(session)

    meta = (await client.get("/meta")).json()
    assert meta["services"] == sorted(GROUPS, key=str.casefold)  # /meta merged the spellings into the labels

    for label in meta["services"]:
        response = await client.get("/search", params={"service": label, "limit": 100})
        found = {item["name"] for item in response.json()["items"]}
        assert found == listings_by_label[label], label  # nothing missed, nothing extra


async def test_nothing_outside_core_service_names_compares_service_names() -> None:
    app_folder = Path(__file__).resolve().parents[2] / "app"
    search_repository_source = (app_folder / "repositories" / "search_repository.py").read_text()
    meta_service_source = (app_folder / "services" / "meta_service.py").read_text()
    assert "normalised_service_name_expression" in search_repository_source
    assert "normalise_service_name" in meta_service_source
    # The old, narrower match is gone, and no other file rebuilds the rule by hand.
    for source_file in app_folder.rglob("*.py"):
        if source_file.name == "service_names.py":
            continue
        source = source_file.read_text()
        assert "lower(Service.name)" not in source, source_file
        assert "func.lower(Service.name)" not in source, source_file
