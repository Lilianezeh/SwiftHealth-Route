"""The "SwiftRescue more groups" data migration, run on the test database. Requirements: FR-15, FR-33.

Feature specs/2026-10-22-swiftrescue-groups/ (the owner's answers): the revision inserts three
emergency categories and renames the display names of three existing ones (fire, emergency-unit,
roadside-assistance), keeping ids, slugs and listings. The downgrade restores the old names and
deletes nothing. The revision's upgrade() is run by hand (tests/revision_loader.py) because the test
database is built with create_all.
"""
import pytest
from sqlalchemy import text
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.repositories import category_repository
from tests.factories import add_listing
from tests.revision_loader import SWIFTRESCUE_GROUPS_REVISION_FILE_PATTERN as GROUPS
from tests.revision_loader import run_downgrade, run_upgrade

pytestmark = pytest.mark.anyio

NEW_SLUGS = ["disaster-flooding", "gbv-support", "mental-health-crisis"]
RENAMED = {
    "fire": ("Fire", "Fire service"),
    "emergency-unit": ("24-hour emergency unit", "Hospital emergency (24 hours)"),
    "roadside-assistance": ("Roadside assistance", "Road accidents"),
}
LISTING_CATEGORIES = "SELECT name, category_id FROM listings ORDER BY name"


async def snapshot(session: AsyncSession) -> list[tuple]:
    rows = await category_repository.list_all(session)
    return [(row.id, row.slug, row.name, row.is_emergency, row.recheck_days) for row in rows]


async def run_sql(session: AsyncSession, sql: str):
    """Raw SQL in the session's transaction (a raw statement goes through the connection)."""
    return await (await session.connection()).execute(text(sql))


async def count_rows_of_every_other_table(session: AsyncSession) -> dict[str, int]:
    return {
        table.name: await session.scalar(text(f'SELECT count(*) FROM "{table.name}"'))
        for table in SQLModel.metadata.sorted_tables
        if table.name != "categories"
    }


async def database_as_it_was(session: AsyncSession) -> None:
    """The 12 categories of the earlier revision, with their old names, and two places in them."""
    await run_upgrade(session)
    await add_listing(session, "Demo Fire Station", category_slug="fire")
    await add_listing(session, "Demo Trauma Unit", category_slug="emergency-unit")


async def test_three_categories_are_added_as_emergency_ones_with_a_14_day_recheck(
    session: AsyncSession,
) -> None:
    await database_as_it_was(session)

    await run_upgrade(session, GROUPS)

    rows = {row[1]: row for row in await snapshot(session)}
    assert len(rows) == 15
    assert rows["disaster-flooding"][2:] == ("Disaster and flooding", True, 14)
    assert rows["gbv-support"][2:] == ("Sexual and gender-based violence support", True, 14)
    assert rows["mental-health-crisis"][2:] == ("Mental health crisis support", True, 14)
    assert [row[1] for row in await snapshot(session)][-3:] == NEW_SLUGS  # appended: ids 13 to 15
    assert sorted(row[0] for row in rows.values())[-3:] == [13, 14, 15]


async def test_three_display_names_change_and_ids_slugs_flags_and_listings_stay(
    session: AsyncSession,
) -> None:
    await database_as_it_was(session)
    before = {row[1]: row for row in await snapshot(session)}
    listings_before = (await run_sql(session, LISTING_CATEGORIES)).all()

    await run_upgrade(session, GROUPS)

    after = {row[1]: row for row in await snapshot(session)}
    for slug, (old_name, new_name) in RENAMED.items():
        assert before[slug][2] == old_name
        same_id_flags_days = (before[slug][0], slug, new_name, before[slug][3], before[slug][4])
        assert after[slug] == same_id_flags_days
    listings_after = (await run_sql(session, LISTING_CATEGORIES)).all()
    assert listings_after == listings_before  # every place still points to the same row


async def test_every_other_category_and_every_other_table_is_unchanged(
    session: AsyncSession,
) -> None:
    await database_as_it_was(session)
    before = {row[1]: row for row in await snapshot(session)}
    tables_before = await count_rows_of_every_other_table(session)

    await run_upgrade(session, GROUPS)

    after = {row[1]: row for row in await snapshot(session)}
    for slug, row in before.items():
        if slug not in RENAMED:
            assert after[slug] == row, slug
    assert await count_rows_of_every_other_table(session) == tables_before
    assert len(SQLModel.metadata.sorted_tables) == 10  # the 9 tables, and the owner links


async def test_a_name_that_staff_changed_by_hand_is_not_overwritten(session: AsyncSession) -> None:
    await database_as_it_was(session)
    await run_sql(session, "UPDATE categories SET name = 'Fire Brigade' WHERE slug = 'fire'")

    await run_upgrade(session, GROUPS)

    rows = {row[1]: row for row in await snapshot(session)}
    assert rows["fire"][2] == "Fire Brigade"
    assert rows["emergency-unit"][2] == "Hospital emergency (24 hours)"


async def test_running_it_twice_changes_nothing(session: AsyncSession) -> None:
    await database_as_it_was(session)
    await run_upgrade(session, GROUPS)
    once = await snapshot(session)

    await run_upgrade(session, GROUPS)

    assert await snapshot(session) == once


async def test_it_also_works_on_a_database_that_started_with_only_three_categories(
    session: AsyncSession,
) -> None:
    # Production had only Clinic, Pharmacy and Laboratory until the earlier revision ran.
    for slug, name in (("clinic", "Clinic"), ("pharmacy", "Pharmacy"), ("laboratory", "Laboratory")):
        await category_repository.create(
            session, name=name, slug=slug, is_emergency=False, recheck_days=45
        )
    await run_upgrade(session)

    await run_upgrade(session, GROUPS)

    rows = {row[1]: row for row in await snapshot(session)}
    assert len(rows) == 15
    assert rows["fire"][2] == "Fire service"


async def test_downgrade_restores_the_three_old_names_and_deletes_nothing(
    session: AsyncSession,
) -> None:
    await database_as_it_was(session)
    before = await snapshot(session)
    await run_upgrade(session, GROUPS)

    await run_downgrade(session, GROUPS)

    after = await snapshot(session)
    assert [row for row in after if row[1] not in NEW_SLUGS] == before  # old names back, same ids
    assert [row[1] for row in after if row[1] in NEW_SLUGS] == NEW_SLUGS  # the new rows stay
    assert await session.scalar(text("SELECT count(*) FROM listings")) == 2


async def test_downgrade_does_not_overwrite_a_name_staff_changed_after_the_upgrade(
    session: AsyncSession,
) -> None:
    await database_as_it_was(session)
    await run_upgrade(session, GROUPS)
    await run_sql(
        session, "UPDATE categories SET name = 'Road Safety Corps' WHERE slug = 'roadside-assistance'"
    )

    await run_downgrade(session, GROUPS)

    rows = {row[1]: row for row in await snapshot(session)}
    assert rows["roadside-assistance"][2] == "Road Safety Corps"
    assert rows["fire"][2] == "Fire"
