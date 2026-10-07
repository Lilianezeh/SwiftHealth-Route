"""Shared test setup: an async PostgreSQL test database. Requirements: FR-30, NFR-06 (never SQLite).

Decisions 10 and 11 in specs/2026-10-05-auth-and-roles/requirements.md. The URL comes from
TEST_DATABASE_URL; the default uses host `db` because the tests run inside the backend container.
"""
import os
from collections.abc import AsyncIterator

import anyio
import pytest
from sqlalchemy import make_url, text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

import app.models  # noqa: F401  (registers all 9 tables)
from app.core.config import settings

DEFAULT_TEST_DATABASE_URL = "postgresql+psycopg://swifthealth:swifthealth@db:5432/swifthealth_test"
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", DEFAULT_TEST_DATABASE_URL)


@pytest.fixture
def anyio_backend() -> str:
    """Runs the async tests on asyncio only (AnyIO's default would try every installed backend)."""
    return "asyncio"


async def prepare_test_database() -> None:
    """Creates the test database if it is missing, then creates all tables in it."""
    test_url = make_url(TEST_DATABASE_URL)
    if test_url.database == make_url(settings.database_url).database:
        raise RuntimeError("TEST_DATABASE_URL is the development database. The tests would erase its data.")

    # CREATE DATABASE cannot run inside a transaction, so connect to the `postgres` database with autocommit.
    admin_engine = create_async_engine(test_url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    async with admin_engine.connect() as connection:
        exists = await connection.scalar(
            text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": test_url.database}
        )
        if not exists:
            quoted_name = connection.dialect.identifier_preparer.quote(test_url.database)
            await connection.execute(text(f"CREATE DATABASE {quoted_name}"))
    await admin_engine.dispose()

    test_engine = create_async_engine(test_url)
    async with test_engine.begin() as connection:
        # create_all is a sync call, so run_sync lets the async connection run it (SQLAlchemy asyncio docs).
        await connection.run_sync(SQLModel.metadata.create_all)
    await test_engine.dispose()


@pytest.fixture(scope="session")
def test_database() -> None:
    anyio.run(prepare_test_database)


@pytest.fixture
async def session(test_database: None) -> AsyncIterator[AsyncSession]:
    """A session on the test database. Every table is emptied first, so no test sees another test's rows."""
    test_engine = create_async_engine(TEST_DATABASE_URL)
    table_names = ", ".join(f'"{table.name}"' for table in SQLModel.metadata.sorted_tables)
    async with test_engine.begin() as connection:
        await connection.execute(text(f"TRUNCATE {table_names} RESTART IDENTITY CASCADE"))
    async with AsyncSession(test_engine, expire_on_commit=False) as test_session:
        yield test_session
    await test_engine.dispose()  # avoids "Event loop is closed" warnings (SQLAlchemy asyncio docs)
