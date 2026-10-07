"""Checks the test setup in tests/conftest.py. Requirements: FR-30, NFR-06 (clean PostgreSQL per test)."""
import anyio
import pytest
from sqlmodel import func, select

from app.core.config import settings
from app.models import Category
from tests import conftest


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
