"""The "owner fee" migration, run on the test database. Requirements: FR-50, NFR-05.
Spec: specs/2026-10-29-owner-fee/.

The revision adds one nullable column to `facility_owners`, `paid_until`, and gives every link
that is approved when the fee starts a paid date one month away (decision Q7: a free first month,
so nobody loses access). Links in any other state stay empty. It adds no table: there are still
exactly 10. The downgrade drops only the column. The revision's upgrade() is run by hand
(tests/revision_loader.py) after the column is dropped, because the test database is built with
create_all. No test here commits. Every name is fictional.
"""

import pytest
from sqlalchemy import text
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from tests.revision_loader import OWNER_FEE_REVISION_FILE_PATTERN as OWNER_FEE
from tests.revision_loader import load_revision, run_downgrade, run_upgrade

pytestmark = pytest.mark.anyio

COLUMN_SQL = (
    "SELECT data_type, is_nullable FROM information_schema.columns "
    "WHERE table_name = 'facility_owners' AND column_name = 'paid_until'"
)


async def run_sql(session: AsyncSession, sql: str, **values: object):
    return await (await session.connection()).execute(text(sql), values)


async def database_as_it_was(session: AsyncSession) -> None:
    """Links in each state, without the new column."""
    await run_sql(session, "ALTER TABLE facility_owners DROP COLUMN paid_until")
    await run_sql(
        session,
        "INSERT INTO categories (name, slug, is_emergency, recheck_days) "
        "VALUES ('Clinic', 'clinic', false, 90)",
    )
    statuses = ["approved", "pending", "removed", "approved"]
    for number, status in enumerate(statuses, start=1):
        user = await run_sql(
            session,
            "INSERT INTO users (name, email, phone, password_hash, role, is_active, created_at, "
            "approval_status, email_verified_at, phone_verified_at) VALUES (:name, :email, :phone, "
            "'hash', 'provider', true, now(), 'approved', now(), now()) RETURNING id",
            name=f"Old owner {number}",
            email=f"old{number}@example.test",
            phone=f"+23400000010{number}",
        )
        listing = await run_sql(
            session,
            "INSERT INTO listings (slug, name, category_id, area, address, latitude, longitude, status, "
            "is_24_hours, created_at, updated_at) SELECT :slug, :name, id, 'Ogui', '1 Example Road', 6.45, "
            "7.5, 'published', false, now(), now() FROM categories WHERE slug = 'clinic' RETURNING id",
            slug=f"old-clinic-{number}",
            name=f"Old Clinic {number}",
        )
        await run_sql(
            session,
            "INSERT INTO facility_owners (listing_id, user_id, role, status, requested_at) "
            "VALUES (:listing, :user, 'owner', :status, now())",
            listing=listing.scalar_one(),
            user=user.scalar_one(),
            status=status,
        )


def test_there_are_still_exactly_ten_tables() -> None:
    assert len(SQLModel.metadata.tables) == 10


async def test_the_column_is_added_nullable_and_with_a_time_zone(session: AsyncSession) -> None:
    await database_as_it_was(session)
    assert (await run_sql(session, COLUMN_SQL)).all() == []

    await run_upgrade(session, OWNER_FEE)

    assert [tuple(row) for row in (await run_sql(session, COLUMN_SQL)).all()] == [
        ("timestamp with time zone", "YES")
    ]


async def test_every_approved_link_is_paid_until_one_month_from_now_and_no_other_link_is(
    session: AsyncSession,
) -> None:
    await database_as_it_was(session)

    await run_upgrade(session, OWNER_FEE)

    rows = (
        await run_sql(
            session,
            "SELECT status, paid_until IS NOT NULL, "
            "paid_until BETWEEN now() + interval '27 days' AND now() + interval '32 days' "
            "FROM facility_owners ORDER BY listing_id",
        )
    ).all()
    assert [tuple(row) for row in rows] == [
        ("approved", True, True),
        ("pending", False, None),
        ("removed", False, None),
        ("approved", True, True),
    ]


async def test_running_the_update_again_changes_nothing(session: AsyncSession) -> None:
    await database_as_it_was(session)
    await run_upgrade(session, OWNER_FEE)
    before = (await run_sql(session, "SELECT id, paid_until FROM facility_owners ORDER BY id")).all()

    await run_sql(session, load_revision(OWNER_FEE).GRANDFATHER_APPROVED_LINKS_SQL)

    assert (await run_sql(session, "SELECT id, paid_until FROM facility_owners ORDER BY id")).all() == before


async def test_the_downgrade_drops_only_the_column(session: AsyncSession) -> None:
    await database_as_it_was(session)
    await run_upgrade(session, OWNER_FEE)

    await run_downgrade(session, OWNER_FEE)

    assert (await run_sql(session, COLUMN_SQL)).all() == []
    kept = await run_sql(session, "SELECT count(*) FROM facility_owners")
    assert kept.scalar_one() == 4
