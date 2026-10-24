"""The "account foundation" migration, run on the test database. Requirements: FR-48, FR-49, NFR-06.

Feature specs/2026-10-23-accounts-and-facility-ownership/ (Phase 2). It only adds columns to `users` and fills
them: every user that exists is approved and has a confirmed email and phone, so nobody (above all the
production admin) is locked out. Nothing is dropped, retyped or deleted; the downgrade drops only the new
columns. The revision's upgrade() is run by hand (tests/revision_loader.py) because the test database is built
with create_all, so the new columns are first removed to look like the database as it was. No test here
commits: the changes to the table are undone with the session.
"""

import pytest
from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession

from tests.revision_loader import ACCOUNT_FOUNDATION_REVISION_FILE_PATTERN as FOUNDATION
from tests.revision_loader import run_downgrade, run_upgrade

pytestmark = pytest.mark.anyio

NEW_COLUMNS = [
    "approval_status",
    "closed_at",
    "email_verified_at",
    "password_changed_at",
    "phone_verified_at",
    "signup_note",
]
ALL_OLD_COLUMNS = "id, name, email, phone, password_hash, role, is_active, created_at, last_login_at"


async def run_sql(session: AsyncSession, sql: str, **values: object):
    return await (await session.connection()).execute(text(sql), values)


async def user_columns(session: AsyncSession) -> set[str]:
    sql = "SELECT column_name FROM information_schema.columns WHERE table_name = 'users'"
    return {row[0] for row in await run_sql(session, sql)}


async def database_as_it_was(session: AsyncSession) -> None:
    """`users` without the new columns, holding one user of each role, as production does."""
    for column in NEW_COLUMNS:
        await run_sql(session, f"ALTER TABLE users DROP COLUMN {column}")
    for number, role in enumerate(["admin", "editor", "verifier", "provider"], start=1):
        await run_sql(
            session,
            "INSERT INTO users "
            "(name, email, phone, password_hash, role, is_active, created_at, last_login_at) "
            "VALUES (:name, :email, :phone, 'hash', :role, :active, "
            "now() - interval '30 days', now() - interval '2 days')",
            name=f"Old {role}",
            email=f"old-{role}@example.test",
            phone=None if role == "provider" else f"+23400000000{number}",
            role=role,
            active=role != "verifier",  # a deactivated user stays deactivated
        )


async def test_the_new_columns_are_added_and_nothing_else_is_touched(session: AsyncSession) -> None:
    await database_as_it_was(session)
    before = await user_columns(session)
    assert not set(NEW_COLUMNS) & before

    await run_upgrade(session, FOUNDATION)

    after = await user_columns(session)
    assert after - before == set(NEW_COLUMNS)  # exactly these six are new
    assert before <= after  # none was removed


async def test_every_existing_user_is_approved_and_confirmed_so_can_still_log_in(
    session: AsyncSession,
) -> None:
    await database_as_it_was(session)

    await run_upgrade(session, FOUNDATION)

    rows = (
        await run_sql(
            session,
            "SELECT role, approval_status, email_verified_at IS NOT NULL, phone_verified_at IS NOT NULL, "
            "closed_at, password_changed_at, signup_note, is_active FROM users ORDER BY id",
        )
    ).all()
    assert [row[0] for row in rows] == ["admin", "editor", "verifier", "provider"]
    for role, approval, email_confirmed, phone_confirmed, closed_at, changed_at, note, active in rows:
        state = (approval, email_confirmed, phone_confirmed, closed_at, changed_at, note)
        assert state == ("approved", True, True, None, None, None), role
        assert active == (role != "verifier")  # a deactivated user stays deactivated


async def test_the_data_of_the_users_is_not_changed(session: AsyncSession) -> None:
    await database_as_it_was(session)
    select_old = f"SELECT {ALL_OLD_COLUMNS} FROM users ORDER BY id"
    before = (await run_sql(session, select_old)).all()

    await run_upgrade(session, FOUNDATION)

    assert (await run_sql(session, select_old)).all() == before


async def test_a_user_added_without_the_new_values_is_approved_by_default_but_not_confirmed(
    session: AsyncSession,
) -> None:
    """The default is "approved", so a copy of the old code that does not know the column still works."""
    await database_as_it_was(session)
    await run_upgrade(session, FOUNDATION)

    await run_sql(
        session,
        "INSERT INTO users (name, email, password_hash, role, is_active, created_at) "
        "VALUES ('New', 'new@example.test', 'hash', 'editor', true, now())",
    )

    sql = "SELECT approval_status, email_verified_at FROM users WHERE email = 'new@example.test'"
    row = (await run_sql(session, sql)).one()
    assert (row[0], row[1]) == ("approved", None)


async def test_the_downgrade_drops_only_the_new_columns_and_keeps_every_user(session: AsyncSession) -> None:
    await database_as_it_was(session)
    await run_upgrade(session, FOUNDATION)

    await run_downgrade(session, FOUNDATION)

    assert not set(NEW_COLUMNS) & await user_columns(session)
    assert (await run_sql(session, "SELECT count(*) FROM users")).scalar_one() == 4


async def test_running_up_down_and_up_again_gives_the_same_result(session: AsyncSession) -> None:
    await database_as_it_was(session)

    await run_upgrade(session, FOUNDATION)
    await run_downgrade(session, FOUNDATION)
    await run_upgrade(session, FOUNDATION)

    statuses = (await run_sql(session, "SELECT DISTINCT approval_status FROM users")).all()
    assert statuses == [("approved",)]
