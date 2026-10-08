import pytest
from sqlalchemy import inspect
from sqlmodel import SQLModel

import app.models  # noqa: F401

NINE_TABLES = {
    "users", "categories", "listings", "phone_numbers", "opening_hours", "services",
    "verification_checks", "user_reports", "audit_entries",
}


def test_the_models_define_exactly_nine_tables():
    assert set(SQLModel.metadata.tables) == NINE_TABLES


@pytest.mark.anyio
async def test_all_nine_tables_exist_in_postgresql(session):
    connection = await session.connection()
    # run_sync: SQLAlchemy's inspector is sync, so the async connection runs it (SQLAlchemy asyncio docs).
    table_names = await connection.run_sync(
        lambda sync_connection: inspect(sync_connection).get_table_names()
    )
    assert set(table_names) == NINE_TABLES
