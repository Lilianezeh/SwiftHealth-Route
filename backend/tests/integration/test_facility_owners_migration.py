"""The "facility owners" migration, run on the test database. Requirements: FR-50, US-19, NFR-09.

Accounts phase 6a (the 10th table, the owner's yes to D1 on 2026-10-24). The revision creates
`facility_owners` and copies every existing `listings.owner_id` into it once as an approved owner link.
Nothing else changes: `listings.owner_id` stays as it was, no other row is touched, a second copy adds
nothing, and the downgrade drops only the new table. The revision's upgrade() is run by hand
(tests/revision_loader.py) after the table is dropped, because the test database is built with
create_all. No test here commits. Every name, address and number is fictional.
"""

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from tests.revision_loader import FACILITY_OWNERS_REVISION_FILE_PATTERN as OWNERS
from tests.revision_loader import load_revision, run_downgrade, run_upgrade

pytestmark = pytest.mark.anyio

MIGRATED = "migrated from listings.owner_id"
LINKS_SQL = "SELECT listing_id, user_id, role, status FROM facility_owners ORDER BY 1"
LISTINGS_SQL = "SELECT slug, owner_id, status, name FROM listings ORDER BY slug"


async def run_sql(session: AsyncSession, sql: str, **values: object):
    return await (await session.connection()).execute(text(sql), values)


async def table_exists(session: AsyncSession) -> bool:
    sql = "SELECT to_regclass('public.facility_owners') IS NOT NULL"
    return bool((await run_sql(session, sql)).scalar())


async def database_as_it_was(session: AsyncSession) -> dict[str, int]:
    """The database before the revision: no table of links; a provider with two listings, another
    with one, a listing with no owner and users who are not providers. Returns the id of each user."""
    await run_sql(session, "DROP TABLE facility_owners")
    users: dict[str, int] = {}
    for number, role in enumerate(["admin", "provider", "provider", "editor"], start=1):
        key = f"{role}{number}"
        row = await run_sql(
            session,
            "INSERT INTO users (name, email, phone, password_hash, role, is_active, created_at, "
            "approval_status, email_verified_at, phone_verified_at) VALUES (:name, :email, :phone, "
            "'hash', :role, true, now(), 'approved', now(), now()) RETURNING id",
            name=f"Old {key}",
            email=f"{key}@example.test",
            phone=f"+23400000000{number}",
            role=role,
        )
        users[key] = row.scalar_one()
    await run_sql(
        session,
        "INSERT INTO categories (name, slug, is_emergency, recheck_days) "
        "VALUES ('Clinic', 'clinic', false, 90)",
    )
    owners = [users["provider2"], users["provider2"], users["provider3"], None]
    for number, owner in enumerate(owners, start=1):
        await run_sql(
            session,
            "INSERT INTO listings (slug, name, category_id, area, address, latitude, longitude, "
            "status, is_24_hours, owner_id, created_at, updated_at) SELECT :slug, :name, id, 'Ogui', "
            "'1 Example Road', 6.45, 7.5, 'published', false, :owner, now(), now() "
            "FROM categories WHERE slug = 'clinic'",
            slug=f"old-clinic-{number}",
            name=f"Old Clinic {number}",
            owner=owner,
        )
    return users


async def count(session: AsyncSession, table: str) -> int:
    return (await run_sql(session, f"SELECT count(*) FROM {table}")).scalar_one()


async def test_the_table_is_created_and_every_old_owner_is_linked_as_an_approved_owner(
    session: AsyncSession,
) -> None:
    users = await database_as_it_was(session)

    await run_upgrade(session, OWNERS)

    rows = (
        await run_sql(
            session,
            "SELECT l.slug, f.user_id, f.role, f.status, f.note, f.approved_at IS NOT NULL, "
            "f.approved_by FROM facility_owners f JOIN listings l ON l.id = f.listing_id "
            "ORDER BY l.slug",
        )
    ).all()
    owner2, owner3 = users["provider2"], users["provider3"]
    assert [tuple(row) for row in rows] == [
        ("old-clinic-1", owner2, "owner", "approved", MIGRATED, True, None),
        ("old-clinic-2", owner2, "owner", "approved", MIGRATED, True, None),
        ("old-clinic-3", owner3, "owner", "approved", MIGRATED, True, None),
    ]


async def test_nothing_else_changes_and_owner_id_stays_where_it_was(session: AsyncSession) -> None:
    users = await database_as_it_was(session)
    before = (await run_sql(session, LISTINGS_SQL)).all()
    users_before = await count(session, "users")

    await run_upgrade(session, OWNERS)

    after = (await run_sql(session, LISTINGS_SQL)).all()
    assert after == before
    assert after[0][1] == users["provider2"] and after[3][1] is None
    assert await count(session, "users") == users_before


async def test_a_listing_with_no_owner_gets_no_link_and_a_second_copy_adds_nothing(
    session: AsyncSession,
) -> None:
    await database_as_it_was(session)
    await run_upgrade(session, OWNERS)
    after_first = await count(session, "facility_owners")

    await run_sql(session, load_revision(OWNERS).COPY_EXISTING_OWNERS_SQL)

    assert after_first == 3  # four listings, one without an owner
    assert await count(session, "facility_owners") == after_first


async def test_the_downgrade_drops_only_the_new_table_and_leaves_the_listings(
    session: AsyncSession,
) -> None:
    await database_as_it_was(session)
    await run_upgrade(session, OWNERS)
    listings_before = await count(session, "listings")

    await run_downgrade(session, OWNERS)

    assert not await table_exists(session)
    assert await count(session, "listings") == listings_before
    assert await count(session, "users") == 4


async def test_up_then_down_then_up_gives_the_same_links(session: AsyncSession) -> None:
    await database_as_it_was(session)
    await run_upgrade(session, OWNERS)
    first = (await run_sql(session, LINKS_SQL)).all()

    await run_downgrade(session, OWNERS)
    await run_upgrade(session, OWNERS)

    assert (await run_sql(session, LINKS_SQL)).all() == first


async def test_one_link_per_listing_and_person_is_enforced_by_the_database(
    session: AsyncSession,
) -> None:
    users = await database_as_it_was(session)
    await run_upgrade(session, OWNERS)
    sql = "SELECT id FROM listings WHERE slug = 'old-clinic-1'"
    listing_id = (await run_sql(session, sql)).scalar_one()

    with pytest.raises(IntegrityError):
        await run_sql(
            session,
            "INSERT INTO facility_owners (listing_id, user_id, role, status, requested_at) "
            "VALUES (:listing, :user, 'manager', 'pending', now())",
            listing=listing_id,
            user=users["provider2"],
        )


async def test_the_project_has_exactly_ten_tables_and_the_new_one_is_the_tenth() -> None:
    names = {table.name for table in SQLModel.metadata.sorted_tables}

    assert len(names) == 10
    assert "facility_owners" in names
