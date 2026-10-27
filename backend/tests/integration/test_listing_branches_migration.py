"""The "listing branches" migration, run on the test database. Requirements: FR-52, US-20, NFR-09.

Accounts phase 8b. The revision adds one nullable column to `listings`, `parent_id` (a foreign key to
the same table, indexed), and nothing else: every existing listing stays a main facility, no row is
rewritten, the downgrade drops only the column and its index. The revision's upgrade() is run by hand
(tests/revision_loader.py) after the column is dropped, because the test database is built with
create_all. No test here commits. Every name and address is fictional.
"""

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlmodel.ext.asyncio.session import AsyncSession

from tests.revision_loader import LISTING_BRANCHES_REVISION_FILE_PATTERN as BRANCHES
from tests.revision_loader import run_downgrade, run_upgrade

pytestmark = pytest.mark.anyio

COLUMN_SQL = (
    "SELECT column_name, data_type, is_nullable FROM information_schema.columns "
    "WHERE table_name = 'listings' AND column_name = 'parent_id'"
)
INDEX_SQL = "SELECT count(*) FROM pg_indexes WHERE tablename = 'listings' AND indexdef LIKE '%(parent_id)%'"
LISTINGS_SQL = "SELECT slug, name, status, address, area FROM listings ORDER BY slug"


async def run_sql(session: AsyncSession, sql: str, **values: object):
    return await (await session.connection()).execute(text(sql), values)


async def database_as_it_was(session: AsyncSession) -> None:
    """Listings of every status, without the new column."""
    await run_sql(session, "ALTER TABLE listings DROP COLUMN parent_id")
    await run_sql(
        session,
        "INSERT INTO categories (name, slug, is_emergency, recheck_days) "
        "VALUES ('Clinic', 'clinic', false, 90)",
    )
    statuses = ["draft", "pending_review", "published", "recheck_due", "hidden"]
    for number, status in enumerate(statuses, start=1):
        await run_sql(
            session,
            "INSERT INTO listings (slug, name, category_id, area, address, latitude, longitude, status, "
            "is_24_hours, created_at, updated_at) SELECT :slug, :name, id, 'Ogui', '1 Example Road', 6.45, "
            "7.5, :status, false, now(), now() FROM categories WHERE slug = 'clinic'",
            slug=f"old-clinic-{number}",
            name=f"Old Clinic {number}",
            status=status,
        )


async def column(session: AsyncSession) -> list[tuple]:
    return [tuple(row) for row in (await run_sql(session, COLUMN_SQL)).all()]


async def test_the_column_is_added_nullable_and_indexed(session: AsyncSession) -> None:
    await database_as_it_was(session)
    assert await column(session) == []

    await run_upgrade(session, BRANCHES)

    assert await column(session) == [("parent_id", "integer", "YES")]
    assert (await run_sql(session, INDEX_SQL)).scalar_one() == 1


async def test_every_old_listing_is_left_as_it_was_and_is_a_main_facility(session: AsyncSession) -> None:
    await database_as_it_was(session)
    before = (await run_sql(session, LISTINGS_SQL)).all()

    await run_upgrade(session, BRANCHES)

    assert (await run_sql(session, LISTINGS_SQL)).all() == before
    nulls = await run_sql(session, "SELECT count(*) FROM listings WHERE parent_id IS NULL")
    assert nulls.scalar_one() == 5


async def test_the_database_refuses_a_parent_that_does_not_exist(session: AsyncSession) -> None:
    await database_as_it_was(session)
    await run_upgrade(session, BRANCHES)

    with pytest.raises(IntegrityError):
        await run_sql(session, "UPDATE listings SET parent_id = 99999 WHERE slug = 'old-clinic-1'")


async def test_the_downgrade_drops_only_the_column_and_its_index(session: AsyncSession) -> None:
    await database_as_it_was(session)
    await run_upgrade(session, BRANCHES)
    await run_sql(
        session,
        "UPDATE listings SET parent_id = (SELECT id FROM listings WHERE slug = 'old-clinic-3') "
        "WHERE slug = 'old-clinic-1'",
    )

    await run_downgrade(session, BRANCHES)

    assert await column(session) == []
    assert (await run_sql(session, INDEX_SQL)).scalar_one() == 0
    slugs = [row[0] for row in (await run_sql(session, LISTINGS_SQL)).all()]
    assert slugs == [f"old-clinic-{number}" for number in range(1, 6)]


async def test_up_down_up_gives_the_same_column(session: AsyncSession) -> None:
    await database_as_it_was(session)
    await run_upgrade(session, BRANCHES)
    first = await column(session)

    await run_downgrade(session, BRANCHES)
    await run_upgrade(session, BRANCHES)

    assert await column(session) == first


async def test_no_table_is_added(session: AsyncSession) -> None:
    await database_as_it_was(session)

    await run_upgrade(session, BRANCHES)

    tables = await run_sql(
        session, "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'"
    )
    assert tables.scalar_one() == 10
