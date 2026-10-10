"""The "all spec categories" data migration, run on the test database.
Requirements: FR-05, FR-01, FR-15, FR-33.

Decisions 2 to 8 in specs/2026-10-10-reference-categories/requirements.md. The revision's upgrade() is run by
hand (tests/revision_loader.py) because the test database is built with create_all.
"""
import pytest
from sqlalchemy import text
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.repositories import category_repository
from app.services import meta_service
from seed.seed_data import CATEGORIES
from tests.factories import add_listing
from tests.revision_loader import run_downgrade, run_upgrade

pytestmark = pytest.mark.anyio

SEED_SLUGS = [category.slug for category in CATEGORIES]


async def snapshot(session: AsyncSession) -> list[tuple]:
    rows = await category_repository.list_all(session)
    return [(row.id, row.slug, row.name, row.is_emergency, row.recheck_days) for row in rows]


async def add_the_three_production_categories(session: AsyncSession) -> None:
    """What production had: only the categories its demo listings needed, in this order."""
    for slug, name in (("clinic", "Clinic"), ("pharmacy", "Pharmacy"), ("laboratory", "Laboratory")):
        await category_repository.create(session, name=name, slug=slug, is_emergency=False, recheck_days=45)


async def count_rows_of_every_other_table(session: AsyncSession) -> dict[str, int]:
    counts = {}
    for table in SQLModel.metadata.sorted_tables:
        if table.name != "categories":
            counts[table.name] = await session.scalar(text(f'SELECT count(*) FROM "{table.name}"'))
    return counts


async def test_empty_table_gets_all_twelve_categories(session: AsyncSession) -> None:
    await run_upgrade(session)

    rows = await snapshot(session)
    assert sorted(row[1] for row in rows) == sorted(SEED_SLUGS)
    assert len(rows) == 12


async def test_categories_are_inserted_in_the_seed_order(session: AsyncSession) -> None:
    await run_upgrade(session)

    rows = await snapshot(session)
    assert [row[1] for row in rows] == SEED_SLUGS
    assert [row[0] for row in rows] == list(range(1, 13))


async def test_clinic_pharmacy_and_laboratory_are_kept_unchanged_and_nine_are_added(
    session: AsyncSession,
) -> None:
    await add_the_three_production_categories(session)
    before = await snapshot(session)

    await run_upgrade(session)

    after = await snapshot(session)
    new_slugs = [slug for slug in SEED_SLUGS if slug not in {"clinic", "pharmacy", "laboratory"}]
    assert len(after) == 12
    assert after[:3] == before  # same ids, names and flags, still first in the /meta order
    assert [row[1] for row in after[3:]] == new_slugs


async def test_running_it_twice_changes_nothing(session: AsyncSession) -> None:
    await run_upgrade(session)
    first_run = await snapshot(session)

    await run_upgrade(session)

    assert await snapshot(session) == first_run


async def test_an_existing_category_is_never_updated(session: AsyncSession) -> None:
    # An editor renamed Pharmacy and an old database has another cycle: the migration must leave both alone.
    await category_repository.create(
        session, name="Chemist", slug="pharmacy", is_emergency=True, recheck_days=99
    )

    await run_upgrade(session)

    pharmacy = await category_repository.get_by_slug(session, "pharmacy")
    assert (pharmacy.name, pharmacy.is_emergency, pharmacy.recheck_days) == ("Chemist", True, 99)


async def test_emergency_categories_get_14_days_and_the_others_45(session: AsyncSession) -> None:  # FR-33
    await run_upgrade(session)

    rows = await category_repository.list_all(session)
    assert {row.recheck_days for row in rows if row.is_emergency} == {14}
    assert {row.recheck_days for row in rows if not row.is_emergency} == {45}
    assert sum(1 for row in rows if row.is_emergency) == 7


async def test_listings_and_every_other_table_are_untouched(session: AsyncSession) -> None:
    listing = await add_listing(
        session, "Night Pharmacy A", category_slug="pharmacy", service_names=("Dispensing",)
    )
    category_id_before = listing.category_id
    counts_before = await count_rows_of_every_other_table(session)
    assert counts_before["listings"] == 1  # the check really sees the listing

    await run_upgrade(session)

    assert await count_rows_of_every_other_table(session) == counts_before
    stored_category_id = await session.scalar(
        text("SELECT category_id FROM listings WHERE id = :id"), {"id": listing.id}
    )
    assert stored_category_id == category_id_before  # the listing still points at its category


async def test_downgrade_removes_nothing(session: AsyncSession) -> None:
    await run_upgrade(session)
    before = await snapshot(session)

    await run_downgrade(session)

    assert await snapshot(session) == before


async def test_get_meta_returns_twelve_categories_after_the_migration(session: AsyncSession) -> None:
    await add_the_three_production_categories(session)

    await run_upgrade(session)

    meta = await meta_service.get_meta(session)
    assert len(meta.categories) == 12
    assert sum(1 for category in meta.categories if category.is_emergency) == 7
    assert [category.slug for category in meta.categories[:3]] == ["clinic", "pharmacy", "laboratory"]
