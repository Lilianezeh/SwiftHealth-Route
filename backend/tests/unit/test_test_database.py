"""Checks the test setup in tests/conftest.py. Requirements: FR-30, NFR-06 (clean PostgreSQL per test)."""
import re

import anyio
import pytest
from sqlalchemy import text
from sqlmodel import func, select

from app.core.config import settings
from app.core.database import get_session
from app.core.rate_limit import login_limiter, verify_code_limiter
from app.core.security import verify_password
from app.main import app
from app.models import Category, User
from app.models.base import Role
from tests import conftest
from tests.conftest import DEMO_PASSWORD


async def count_categories(session) -> int:
    return (await session.exec(select(func.count()).select_from(Category))).one()


# The next two tests depend on running in this order (pytest runs a file top to bottom).
@pytest.mark.anyio
async def test_first_test_writes_a_row(session):
    session.add(Category(name="Demo", slug="demo", is_emergency=False, recheck_days=45))
    await session.commit()
    assert await count_categories(session) == 1


@pytest.mark.anyio
async def test_a_row_written_in_the_previous_test_is_gone(session):
    assert await count_categories(session) == 0


def test_the_test_database_is_never_the_development_database(monkeypatch):
    monkeypatch.setattr(conftest, "TEST_DATABASE_URL", settings.database_url)
    with pytest.raises(RuntimeError, match="development database"):
        anyio.run(conftest.prepare_test_database)


# --- the HTTP client and the session override ---

@pytest.mark.anyio
async def test_the_client_reaches_the_app(client):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.anyio
async def test_routes_get_the_test_session_on_the_test_database(client, session):
    override = app.dependency_overrides[get_session]
    route_sessions = [route_session async for route_session in override()]
    assert route_sessions == [session]
    database_name = (await session.exec(text("select current_database()"))).scalar()
    assert database_name == "swifthealth_test"


# The next two tests depend on running in this order.
@pytest.mark.anyio
async def test_the_session_override_exists_while_the_client_is_in_use(client):
    assert get_session in app.dependency_overrides


def test_the_session_override_is_removed_after_the_test():
    assert get_session not in app.dependency_overrides


# --- the rate limiters ---

# The next two tests depend on running in this order.
def test_first_test_uses_up_the_login_limit():
    for _ in range(10):
        assert login_limiter.allow("1.1.1.1")
    assert not login_limiter.allow("1.1.1.1")


def test_the_limiters_start_empty_in_the_next_test():
    assert login_limiter.allow("1.1.1.1")
    assert verify_code_limiter.allow("1.1.1.1")


# --- demo users ---

@pytest.mark.anyio
async def test_demo_users_exist_one_per_role(demo_users):
    assert set(demo_users) == set(Role)
    for role, user in demo_users.items():
        assert user.role == role
        assert user.is_active
        assert user.id is not None
        assert re.fullmatch(r"\+2340\d{9}", user.phone)  # +234 then 0...: can never be a real number
        assert verify_password(DEMO_PASSWORD, user.password_hash)
    assert len({user.email for user in demo_users.values()}) == len(Role)
    assert len({user.phone for user in demo_users.values()}) == len(Role)


@pytest.mark.anyio
async def test_demo_users_are_saved_in_the_database(demo_users, session):
    count = (await session.exec(select(func.count()).select_from(User))).one()
    assert count == len(Role)
