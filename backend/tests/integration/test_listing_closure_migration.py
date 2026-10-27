"""The "listing closure" migration, run on the test database. Requirements: FR-53, US-20, NFR-09.

Accounts phase 8a. The revision adds two nullable columns to `listings`, `closed_at` and `closed_reason`, and
nothing else: no row is rewritten, no status value is added, the downgrade drops only those two columns. The
revision's upgrade() is run by hand (tests/revision_loader.py) after the columns are dropped, because the test
database is built with create_all. No test here commits. Every name and address is fictional.
"""

import pytest
from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession

from tests.revision_loader import LISTING_CLOSURE_REVISION_FILE_PATTERN as CLOSURE
from tests.revision_loader import run_downgrade, run_upgrade

pytestmark = pytest.mark.anyio

COLUMNS_SQL = (
    "SELECT column_name, data_type, is_nullable, character_maximum_length FROM information_schema.columns "
    "WHERE table_name = 'listings' AND column_name IN ('closed_at', 'closed_reason') ORDER BY column_name"
)
LISTINGS_SQL = "SELECT slug, name, status, address, area, featured_until FROM listings ORDER BY slug"


async def run_sql(session: AsyncSession, sql: str, **values: object):
    return await (await session.connection()).execute(text(sql), values)


async def database_as_it_was(session: AsyncSession) -> None:
    """Listings of every status, without the two new columns."""
    await run_sql(session, "ALTER TABLE listings DROP COLUMN closed_at, DROP COLUMN closed_reason")
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


async def columns(session: AsyncSession) -> list[tuple]:
    return [tuple(row) for row in (await run_sql(session, COLUMNS_SQL)).all()]


async def test_the_two_columns_are_added_nullable(session: AsyncSession) -> None:
    await database_as_it_was(session)
    assert await columns(session) == []

    await run_upgrade(session, CLOSURE)

    assert await columns(session) == [
        ("closed_at", "timestamp with time zone", "YES", None),
        ("closed_reason", "character varying", "YES", 200),
    ]


async def test_every_old_row_is_left_as_it_was_with_both_columns_null(session: AsyncSession) -> None:
    await database_as_it_was(session)
    before = (await run_sql(session, LISTINGS_SQL)).all()

    await run_upgrade(session, CLOSURE)

    assert (await run_sql(session, LISTINGS_SQL)).all() == before
    nulls = await run_sql(
        session, "SELECT count(*) FROM listings WHERE closed_at IS NULL AND closed_reason IS NULL"
    )
    assert nulls.scalar_one() == 5


async def test_the_downgrade_drops_only_the_two_columns(session: AsyncSession) -> None:
    await database_as_it_was(session)
    await run_upgrade(session, CLOSURE)
    await run_sql(
        session,
        "UPDATE listings SET closed_at = now(), closed_reason = 'moved away' WHERE slug = 'old-clinic-5'",
    )

    await run_downgrade(session, CLOSURE)

    assert await columns(session) == []
    assert (await run_sql(session, "SELECT count(*) FROM listings")).scalar_one() == 5
    slugs = [row[0] for row in (await run_sql(session, LISTINGS_SQL)).all()]
    assert slugs == [f"old-clinic-{number}" for number in range(1, 6)]


async def test_up_down_up_gives_the_same_columns(session: AsyncSession) -> None:
    await database_as_it_was(session)
    await run_upgrade(session, CLOSURE)
    first = await columns(session)

    await run_downgrade(session, CLOSURE)
    await run_upgrade(session, CLOSURE)

    assert await columns(session) == first


async def test_no_status_value_was_added_and_no_table_was_added(session: AsyncSession) -> None:
    await database_as_it_was(session)

    await run_upgrade(session, CLOSURE)

    tables = await run_sql(
        session, "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'"
    )
    assert tables.scalar_one() == 10
    labels = await run_sql(
        session,
        "SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid "
        "WHERE t.oid = (SELECT atttypid FROM pg_attribute WHERE attrelid = 'listings'::regclass "
        "AND attname = 'status') ORDER BY e.enumsortorder",
    )
    assert [row[0] for row in labels.all()] == [
        "draft", "pending_review", "published", "recheck_due", "hidden",
    ]
