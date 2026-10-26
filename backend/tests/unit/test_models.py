import pytest
from sqlalchemy import inspect
from sqlmodel import SQLModel

import app.models  # noqa: F401

# The nine tables of the first design, and the tenth: facility_owners (accounts phase 6, the owner's yes to
# decision D1 on 2026-10-24). A new table needs the owner's approval first (CLAUDE.md).
NINE_TABLES = {
    "users", "categories", "listings", "phone_numbers", "opening_hours", "services",
    "verification_checks", "user_reports", "audit_entries",
}
TEN_TABLES = NINE_TABLES | {"facility_owners"}


def test_the_models_define_exactly_ten_tables():
    assert set(SQLModel.metadata.tables) == TEN_TABLES


@pytest.mark.anyio
async def test_all_ten_tables_exist_in_postgresql(session):
    connection = await session.connection()
    # run_sync: SQLAlchemy's inspector is sync, so the async connection runs it (SQLAlchemy asyncio docs).
    table_names = await connection.run_sync(
        lambda sync_connection: inspect(sync_connection).get_table_names()
    )
    assert set(table_names) == TEN_TABLES
