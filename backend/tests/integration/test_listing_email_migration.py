"""The "listing email" migration, run on the test database. Requirements: US-17, NFR-05, NFR-07.
Spec: specs/2026-11-01-owner-form-fields/ (decision F1: the facility's email is kept for staff only).

The revision adds one nullable text column to `listings`, `email`. It adds no table: there are still
exactly 10. Every listing that exists keeps an empty email. The downgrade drops only the column. The
revision's upgrade() is run by hand (tests/revision_loader.py) after the column is dropped, because the
test database is built with create_all. No test here commits. Every name is fictional.
"""

import pytest
from sqlalchemy import text
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from tests.revision_loader import LISTING_EMAIL_REVISION_FILE_PATTERN as LISTING_EMAIL
from tests.revision_loader import run_downgrade, run_upgrade

pytestmark = pytest.mark.anyio

COLUMN_SQL = (
    "SELECT data_type, is_nullable FROM information_schema.columns "
    "WHERE table_name = 'listings' AND column_name = 'email'"
)


async def run_sql(session: AsyncSession, sql: str):
    return await (await session.connection()).execute(text(sql))


async def database_as_it_was(session: AsyncSession) -> None:
    """Two listings, without the new column."""
    await run_sql(session, "ALTER TABLE listings DROP COLUMN email")
    await run_sql(
        session,
        "INSERT INTO categories (name, slug, is_emergency, recheck_days) "
        "VALUES ('Clinic', 'clinic', false, 90)",
    )
    for number in (1, 2):
        await run_sql(
            session,
            "INSERT INTO listings (slug, name, category_id, area, address, latitude, longitude, status, "
            "is_24_hours, created_at, updated_at) SELECT "
            f"'old-clinic-{number}', 'Old Clinic {number}', id, 'Ogui', '1 Example Road', 6.45, 7.5, "
            "'published', false, now(), now() FROM categories WHERE slug = 'clinic'",
        )


def test_there_are_still_exactly_ten_tables() -> None:
    assert len(SQLModel.metadata.tables) == 10


async def test_the_column_is_added_as_nullable_text(session: AsyncSession) -> None:
    await database_as_it_was(session)
    assert (await run_sql(session, COLUMN_SQL)).all() == []

    await run_upgrade(session, LISTING_EMAIL)

    columns = (await run_sql(session, COLUMN_SQL)).all()
    assert [tuple(row) for row in columns] == [("character varying", "YES")]


async def test_every_listing_that_exists_keeps_an_empty_email(session: AsyncSession) -> None:
    await database_as_it_was(session)

    await run_upgrade(session, LISTING_EMAIL)

    rows = (await run_sql(session, "SELECT name, email FROM listings ORDER BY id")).all()
    assert [tuple(row) for row in rows] == [("Old Clinic 1", None), ("Old Clinic 2", None)]


async def test_the_downgrade_drops_only_the_column(session: AsyncSession) -> None:
    await database_as_it_was(session)
    await run_upgrade(session, LISTING_EMAIL)

    await run_downgrade(session, LISTING_EMAIL)

    assert (await run_sql(session, COLUMN_SQL)).all() == []
    assert (await run_sql(session, "SELECT count(*) FROM listings")).scalar_one() == 2
