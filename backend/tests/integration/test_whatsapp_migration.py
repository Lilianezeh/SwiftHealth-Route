"""The "phone is_whatsapp" migration, run on the test database. Requirement: FR-47.

Decision 10 in specs/2026-10-11-listing-detail-api/requirements.md. The test database is built with
create_all, so the column is already there: each test takes it away first (inside the test's
transaction, which is rolled back at the end), so the revision's upgrade() starts from the table as it
was in production, with rows in it. upgrade() and downgrade() are run by hand (tests/revision_loader.py).
"""
import re

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import CursorResult, text
from sqlmodel.ext.asyncio.session import AsyncSession

from tests.factories import add_listing
from tests.revision_loader import (
    BACKEND_FOLDER,
    WHATSAPP_REVISION_FILE_PATTERN,
    load_revision,
    revision_file,
    run_downgrade,
    run_upgrade,
)

pytestmark = pytest.mark.anyio

LAST_REVISION_BEFORE_THIS_ONE = "f6184e303abb"  # all spec categories


async def upgrade(session: AsyncSession) -> None:
    await run_upgrade(session, WHATSAPP_REVISION_FILE_PATTERN)


async def downgrade(session: AsyncSession) -> None:
    await run_downgrade(session, WHATSAPP_REVISION_FILE_PATTERN)


async def run_sql(session: AsyncSession, sql: str, **parameters: str) -> CursorResult:
    """Raw SQL in the session's transaction, through its connection (SQLModel deprecates session.execute)."""
    connection = await session.connection()
    return await connection.execute(text(sql), parameters)


async def drop_the_column(session: AsyncSession) -> None:
    """The table as production had it before this revision."""
    await run_sql(session, "ALTER TABLE phone_numbers DROP COLUMN is_whatsapp")


async def columns_of(session: AsyncSession, table: str) -> list[tuple]:
    result = await run_sql(
        session,
        "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns "
        "WHERE table_name = :table ORDER BY column_name",
        table=table,
    )
    return [tuple(row) for row in result]


async def every_table_except_phone_numbers(session: AsyncSession) -> dict[str, list[tuple]]:
    result = await run_sql(
        session,
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
    )
    names = result.scalars().all()
    return {name: await columns_of(session, name) for name in names if name != "phone_numbers"}


async def phone_rows(session: AsyncSession) -> list[tuple]:
    result = await run_sql(
        session,
        "SELECT id, listing_id, number, label, is_primary, last_working_at FROM phone_numbers ORDER BY id",
    )
    return [tuple(row) for row in result]


async def is_whatsapp_values(session: AsyncSession) -> list[bool]:
    return (await run_sql(session, "SELECT is_whatsapp FROM phone_numbers ORDER BY id")).scalars().all()


async def add_two_listings_with_phones(session: AsyncSession) -> None:
    await add_listing(session, "Night Pharmacy A", phone="+2340000000011")
    await add_listing(session, "Night Pharmacy B", phone="+2340000000012")


async def test_the_column_is_added_to_a_table_that_already_has_rows_and_they_become_false(
    session: AsyncSession,
) -> None:
    await add_two_listings_with_phones(session)
    await drop_the_column(session)

    await upgrade(session)

    values = await is_whatsapp_values(session)
    assert values == [False, False]  # both rows kept, both false (production has demo rows when this runs)


async def test_the_new_column_is_not_null_with_a_default_of_false(session: AsyncSession) -> None:
    await add_two_listings_with_phones(session)
    await drop_the_column(session)

    await upgrade(session)

    row = next(row for row in await columns_of(session, "phone_numbers") if row[0] == "is_whatsapp")
    assert row == ("is_whatsapp", "boolean", "NO", "false")


async def test_the_table_after_the_upgrade_is_the_table_the_model_creates(session: AsyncSession) -> None:
    columns_from_the_model = await columns_of(session, "phone_numbers")
    await drop_the_column(session)

    await upgrade(session)

    assert await columns_of(session, "phone_numbers") == columns_from_the_model


async def test_the_upgrade_changes_no_other_column_and_no_other_table(session: AsyncSession) -> None:
    await add_two_listings_with_phones(session)
    rows_before = await phone_rows(session)
    other_tables_before = await every_table_except_phone_numbers(session)
    await drop_the_column(session)

    await upgrade(session)

    assert await phone_rows(session) == rows_before  # same ids, numbers, labels, flags and dates
    assert await every_table_except_phone_numbers(session) == other_tables_before


async def test_the_downgrade_drops_the_column_and_keeps_the_rows(session: AsyncSession) -> None:
    await add_two_listings_with_phones(session)
    rows_before = await phone_rows(session)

    await downgrade(session)

    names = [row[0] for row in await columns_of(session, "phone_numbers")]
    assert "is_whatsapp" not in names
    assert await phone_rows(session) == rows_before


async def test_upgrade_then_downgrade_then_upgrade_again_works(session: AsyncSession) -> None:
    await add_two_listings_with_phones(session)
    rows_before = await phone_rows(session)
    columns_before = await columns_of(session, "phone_numbers")

    await downgrade(session)
    await upgrade(session)

    assert await columns_of(session, "phone_numbers") == columns_before
    assert await phone_rows(session) == rows_before
    assert await is_whatsapp_values(session) == [False, False]


def test_the_revision_follows_the_categories_revision_and_is_the_only_head() -> None:
    module = load_revision(WHATSAPP_REVISION_FILE_PATTERN)
    config = Config(str(BACKEND_FOLDER / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_FOLDER / "alembic"))
    config.set_main_option("path_separator", "os")  # silences Alembic's warning about the old default

    assert module.down_revision == LAST_REVISION_BEFORE_THIS_ONE
    assert ScriptDirectory.from_config(config).get_heads() == [module.revision]


def test_the_revision_uses_alembic_operations_only_and_names_only_phone_numbers() -> None:
    text_of_file = revision_file(WHATSAPP_REVISION_FILE_PATTERN).read_text()
    # The comments and the docstring may use any word, so they are removed first.
    code = re.sub(r'"""[\s\S]*?"""', "", re.sub(r"#.*", "", text_of_file))

    assert "phone_numbers" in code
    assert "op.execute" not in code  # no hand-written SQL, so nothing is built from a string
    other_tables = (
        "listings", "categories", "opening_hours", "services", "users", "user_reports", "audit_entries",
    )
    for other_table in other_tables:
        assert other_table not in code, other_table
