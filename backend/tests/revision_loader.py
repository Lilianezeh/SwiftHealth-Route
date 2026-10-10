"""Loads the "all spec categories" Alembic revision as a module, so tests can read it and run it.

The test database is built with create_all, not Alembic (conftest.py), so the revision's upgrade() is run
by hand through Alembic's Operations on a connection: the same SQL that `alembic upgrade head` executes.
Requirements: FR-05, FR-15, FR-33. Feature: specs/2026-10-10-reference-categories/.
"""
import importlib.util
from collections.abc import Callable
from pathlib import Path
from types import ModuleType

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import Connection
from sqlmodel.ext.asyncio.session import AsyncSession

BACKEND_FOLDER = Path(__file__).resolve().parents[1]
VERSIONS_FOLDER = BACKEND_FOLDER / "alembic" / "versions"
REVISION_FILE_PATTERN = "*_all_spec_categories.py"


def revision_file() -> Path:
    files = list(VERSIONS_FOLDER.glob(REVISION_FILE_PATTERN))
    assert len(files) == 1, f"expected one revision file named {REVISION_FILE_PATTERN}, found {files}"
    return files[0]


def load_revision() -> ModuleType:
    file = revision_file()
    spec = importlib.util.spec_from_file_location("all_spec_categories_revision", file)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _run_with_operations(connection: Connection, function: Callable[[], None]) -> None:
    with Operations.context(MigrationContext.configure(connection)):
        function()


async def run_upgrade(session: AsyncSession) -> None:
    """Runs the revision's upgrade() inside the session's transaction."""
    function = load_revision().upgrade
    await (await session.connection()).run_sync(lambda connection: _run_with_operations(connection, function))


async def run_downgrade(session: AsyncSession) -> None:
    function = load_revision().downgrade
    await (await session.connection()).run_sync(lambda connection: _run_with_operations(connection, function))
