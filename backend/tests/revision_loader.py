"""Loads an Alembic revision as a module, so tests can read it and run it.

The test database is built with create_all, not Alembic (conftest.py), so a revision's upgrade() is run
by hand through Alembic's Operations on a connection: the same SQL that `alembic upgrade head` executes.
A revision is found by the pattern of its file name; with no pattern it is the "all spec categories" revision.
Requirements: FR-05, FR-15, FR-33 (categories), FR-47 (is_whatsapp).
Features: specs/2026-10-10-reference-categories/, specs/2026-10-11-listing-detail-api/.
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
WHATSAPP_REVISION_FILE_PATTERN = "*_phone_is_whatsapp.py"
# Feature specs/2026-10-22-swiftrescue-groups/
SWIFTRESCUE_GROUPS_REVISION_FILE_PATTERN = "*_swiftrescue_more_groups.py"
# Feature specs/2026-10-23-accounts-and-facility-ownership/ (Phase 2)
ACCOUNT_FOUNDATION_REVISION_FILE_PATTERN = "*_account_foundation.py"
# Phase 2c
AUTHENTICATOR_APP_REVISION_FILE_PATTERN = "*_authenticator_app.py"
# Phase 6a (the 10th table)
FACILITY_OWNERS_REVISION_FILE_PATTERN = "*_facility_owners.py"
# Phase 8a (listings.closed_at and closed_reason)
LISTING_CLOSURE_REVISION_FILE_PATTERN = "*_listing_closure.py"
# Phase 8b (listings.parent_id)
LISTING_BRANCHES_REVISION_FILE_PATTERN = "*_listing_branches.py"


def revision_file(pattern: str = REVISION_FILE_PATTERN) -> Path:
    files = list(VERSIONS_FOLDER.glob(pattern))
    assert len(files) == 1, f"expected one revision file named {pattern}, found {files}"
    return files[0]


def load_revision(pattern: str = REVISION_FILE_PATTERN) -> ModuleType:
    file = revision_file(pattern)
    spec = importlib.util.spec_from_file_location(f"revision_{file.stem}", file)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _run_with_operations(connection: Connection, function: Callable[[], None]) -> None:
    with Operations.context(MigrationContext.configure(connection)):
        function()


async def run_upgrade(session: AsyncSession, pattern: str = REVISION_FILE_PATTERN) -> None:
    """Runs the revision's upgrade() inside the session's transaction."""
    function = load_revision(pattern).upgrade
    await (await session.connection()).run_sync(lambda connection: _run_with_operations(connection, function))


async def run_downgrade(session: AsyncSession, pattern: str = REVISION_FILE_PATTERN) -> None:
    function = load_revision(pattern).downgrade
    await (await session.connection()).run_sync(lambda connection: _run_with_operations(connection, function))
