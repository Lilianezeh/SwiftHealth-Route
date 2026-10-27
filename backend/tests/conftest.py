"""Shared test setup: an async PostgreSQL test database. Requirements: FR-30, NFR-06 (never SQLite).

Decisions 10 and 11 in specs/2026-10-05-auth-and-roles/requirements.md. The URL comes from
TEST_DATABASE_URL; the default uses host `db` because the tests run inside the backend container.
"""
import os
from collections.abc import AsyncIterator, Iterator

import anyio
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import make_url, text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

import app.models  # noqa: F401  (registers all 9 tables)
from app.core.config import settings
from app.core.database import get_session
from app.core.rate_limit import (
    forgot_email_limiter,
    forgot_ip_limiter,
    login_limiter,
    password_failure_limiter,
    report_limiter,
    signup_code_failure_limiter,
    signup_email_limiter,
    signup_limiter,
    sms_code_limiter,
    submission_limiter,
    totp_failure_limiter,
    verify_code_limiter,
)
from app.core.security import hash_password
from app.main import app
from app.models import User
from app.models.base import Role
from app.repositories import user_repository

DEFAULT_TEST_DATABASE_URL = "postgresql+psycopg://swifthealth:swifthealth@db:5432/swifthealth_test"
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", DEFAULT_TEST_DATABASE_URL)
DEMO_PASSWORD = "demo-password-for-tests"  # fake, used only by the test demo users


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
        await connection.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))  # search text match, FR-04
        # create_all is a sync call, so run_sync lets the async connection run it (SQLAlchemy asyncio docs).
        # drop_all first: create_all never changes a table that exists, so a new column would be missing.
        # Safe: this is the throwaway test database (the guard above refuses the development database).
        await connection.run_sync(SQLModel.metadata.drop_all)
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


@pytest.fixture(autouse=True)
def reset_rate_limiters() -> None:
    """Every test starts with empty rate-limit counters, so one test cannot block another."""
    login_limiter.reset()
    verify_code_limiter.reset()
    report_limiter.reset()
    submission_limiter.reset()
    sms_code_limiter.reset()
    totp_failure_limiter.reset()
    signup_limiter.reset()
    signup_email_limiter.reset()
    signup_code_failure_limiter.reset()
    forgot_email_limiter.reset()
    forgot_ip_limiter.reset()
    password_failure_limiter.reset()


@pytest.fixture
def session_override(session: AsyncSession) -> Iterator[None]:
    """Makes the routes use the test session instead of the development database. Removed after the test."""

    async def get_test_session() -> AsyncIterator[AsyncSession]:
        yield session

    app.dependency_overrides[get_session] = get_test_session
    yield
    app.dependency_overrides.pop(get_session, None)


@pytest.fixture
async def client(session_override: None) -> AsyncIterator[AsyncClient]:
    """An HTTP client that calls the app in memory. AsyncClient runs no lifespan events (FastAPI docs)."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as test_client:
        yield test_client


@pytest.fixture(scope="session")
def demo_password_hash() -> str:
    """Argon2 is slow on purpose, so the demo password is hashed once for the whole test run."""
    return hash_password(DEMO_PASSWORD)


@pytest.fixture
async def demo_users(session: AsyncSession, demo_password_hash: str) -> dict[Role, User]:
    """One active user per role. Fictional +2340... phone numbers; every user has the DEMO_PASSWORD."""
    users = {}
    for number, role in enumerate(Role, start=1):
        users[role] = await user_repository.create(
            session,
            name=f"Demo {role.value.title()}",
            email=f"{role.value}@demo.example.com",
            phone=f"+234000000000{number}",
            password_hash=demo_password_hash,
            role=role,
        )
    await session.commit()
    return users
