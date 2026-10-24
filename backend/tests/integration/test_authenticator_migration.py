"""The "authenticator app" migration, run on the test database. Requirements: FR-58, NFR-06.

Feature specs/2026-10-23-accounts-and-facility-ownership/ (Phase 2c). It only adds four empty columns to
`users`: every existing user keeps logging in exactly as before (no app switched on), nothing is dropped
or changed, and the downgrade drops only those four columns. The revision's upgrade() is run by hand
(tests/revision_loader.py) after the new columns are removed, because the test database is built with
create_all. No test here commits.
"""

import pytest
from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession

from tests.revision_loader import AUTHENTICATOR_APP_REVISION_FILE_PATTERN as AUTHENTICATOR
from tests.revision_loader import run_downgrade, run_upgrade

pytestmark = pytest.mark.anyio

NEW_COLUMNS = ["backup_code_hashes", "totp_enabled_at", "totp_last_step", "totp_secret"]
OLD_COLUMNS = "id, name, email, phone, password_hash, role, is_active, approval_status, email_verified_at"


async def run_sql(session: AsyncSession, sql: str, **values: object):
    return await (await session.connection()).execute(text(sql), values)


async def user_columns(session: AsyncSession) -> set[str]:
    sql = "SELECT column_name FROM information_schema.columns WHERE table_name = 'users'"
    return {row[0] for row in await run_sql(session, sql)}


async def database_as_it_was(session: AsyncSession) -> None:
    for column in NEW_COLUMNS:
        await run_sql(session, f"ALTER TABLE users DROP COLUMN {column}")
    for number, role in enumerate(["admin", "editor", "verifier", "provider"], start=1):
        await run_sql(
            session,
            "INSERT INTO users (name, email, phone, password_hash, role, is_active, created_at, "
            "approval_status, email_verified_at, phone_verified_at) "
            "VALUES (:name, :email, :phone, 'hash', :role, true, now(), 'approved', now(), now())",
            name=f"Old {role}",
            email=f"old-{role}@example.test",
            phone=f"+23400000000{number}",
            role=role,
        )


async def test_four_empty_columns_are_added_and_every_user_has_no_app(session: AsyncSession) -> None:
    await database_as_it_was(session)
    before = await user_columns(session)

    await run_upgrade(session, AUTHENTICATOR)

    after = await user_columns(session)
    assert after - before == set(NEW_COLUMNS)
    assert before <= after
    rows = (
        await run_sql(
            session,
            "SELECT count(*), count(totp_secret), count(totp_enabled_at), count(totp_last_step), "
            "count(backup_code_hashes) FROM users",
        )
    ).one()
    assert tuple(rows) == (4, 0, 0, 0, 0)


async def test_the_data_of_the_users_is_not_changed(session: AsyncSession) -> None:
    await database_as_it_was(session)
    select_old = f"SELECT {OLD_COLUMNS} FROM users ORDER BY id"
    before = (await run_sql(session, select_old)).all()

    await run_upgrade(session, AUTHENTICATOR)

    assert (await run_sql(session, select_old)).all() == before


async def test_the_downgrade_drops_only_the_four_columns_and_keeps_every_user(session: AsyncSession) -> None:
    await database_as_it_was(session)
    await run_upgrade(session, AUTHENTICATOR)

    await run_downgrade(session, AUTHENTICATOR)

    assert not set(NEW_COLUMNS) & await user_columns(session)
    assert (await run_sql(session, "SELECT count(*) FROM users")).scalar_one() == 4


async def test_up_down_up_gives_the_same_result(session: AsyncSession) -> None:
    await database_as_it_was(session)

    await run_upgrade(session, AUTHENTICATOR)
    await run_downgrade(session, AUTHENTICATOR)
    await run_upgrade(session, AUTHENTICATOR)

    assert NEW_COLUMNS == sorted(set(NEW_COLUMNS) & await user_columns(session))
