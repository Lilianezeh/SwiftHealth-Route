"""The production demo listings: seed, cleanup and flags in the database. Requirements: US-01, FR-04.

Decision 13 in specs/2026-10-09-search-backend/requirements.md. Runs on the PostgreSQL test database.
"""
import logging
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import func
from sqlmodel import SQLModel, col, select
from sqlmodel.ext.asyncio.session import AsyncSession

import seed.demo_listings as demo_listings
from app.models import (
    AuditEntry,
    Category,
    Listing,
    OpeningHours,
    PhoneNumber,
    Service,
    User,
    UserReport,
    VerificationCheck,
)
from app.models.base import CheckMethod, CheckResult, ListingStatus, Role
from app.repositories import audit_repository, listing_repository
from app.schemas.search import SearchParams
from app.services.search_service import search_listings
from seed.demo_listings import REMOVE_FLAG, SEED_FLAG, apply_flags, remove_demo_listings, seed_demo_listings
from seed.demo_listings_data import DEMO_LISTING_SLUGS, DEMO_LISTINGS
from tests.factories import add_listing, add_report

pytestmark = pytest.mark.anyio

NOW = datetime(2026, 10, 9, 12, 0, tzinfo=timezone.utc)
ALL_TABLES = (Listing, PhoneNumber, OpeningHours, Service, VerificationCheck, UserReport, AuditEntry)


async def count(session: AsyncSession, model: type[SQLModel]) -> int:
    return (await session.exec(select(func.count()).select_from(model))).one()


async def table_counts(session: AsyncSession) -> dict[str, int]:
    return {model.__tablename__: await count(session, model) for model in (*ALL_TABLES, Category, User)}


async def demo_listings_in_database(session: AsyncSession) -> list[Listing]:
    return list((await session.exec(select(Listing).where(col(Listing.slug).in_(DEMO_LISTING_SLUGS)))).all())


async def test_seed_creates_the_demo_listings_with_phones_hours_and_services(session: AsyncSession) -> None:
    created = await seed_demo_listings(session, NOW)
    assert created["listings"] == len(DEMO_LISTINGS)
    listings = {listing.slug: listing for listing in await demo_listings_in_database(session)}
    assert set(listings) == set(DEMO_LISTING_SLUGS)
    for seed in DEMO_LISTINGS:
        listing = listings[seed.slug]
        assert listing.name == seed.name
        assert listing.status == ListingStatus.published
        phones = (await session.exec(select(PhoneNumber).where(PhoneNumber.listing_id == listing.id))).all()
        assert [phone.number for phone in phones] == [phone.number for phone in seed.phones]
        hours = (await session.exec(select(OpeningHours).where(OpeningHours.listing_id == listing.id))).all()
        assert len(hours) == 7
        services = (await session.exec(select(Service).where(Service.listing_id == listing.id))).all()
        assert sorted(item.name for item in services) == sorted(item.name for item in seed.services)


async def test_seed_twice_creates_nothing_the_second_time(session: AsyncSession) -> None:
    await seed_demo_listings(session, NOW)
    after_first = await table_counts(session)
    second = await seed_demo_listings(session, NOW)
    assert second == {"categories": 0, "listings": 0}
    assert await table_counts(session) == after_first


async def test_seed_does_not_overwrite_a_changed_demo_listing(session: AsyncSession) -> None:
    await seed_demo_listings(session, NOW)
    listing = (await demo_listings_in_database(session))[0]
    listing.address = "Changed by staff"
    session.add(listing)
    await session.commit()
    await seed_demo_listings(session, NOW)
    await session.refresh(listing)
    assert listing.address == "Changed by staff"


async def test_seed_adds_a_missing_category_and_creates_no_user(session: AsyncSession) -> None:
    created = await seed_demo_listings(session, NOW)
    assert created["categories"] == len({seed.category_slug for seed in DEMO_LISTINGS})
    assert await count(session, Category) == created["categories"]
    assert await count(session, User) == 0
    assert await count(session, VerificationCheck) == 0  # those need a staff user


async def test_seed_does_not_add_a_category_that_already_exists(session: AsyncSession) -> None:
    await add_listing(session, "Ogui Road Pharmacy", category_slug="pharmacy")  # creates "pharmacy"
    await session.commit()
    created = await seed_demo_listings(session, NOW)
    assert created["categories"] == len({seed.category_slug for seed in DEMO_LISTINGS}) - 1
    pharmacies = (await session.exec(select(Category).where(Category.slug == "pharmacy"))).all()
    assert len(pharmacies) == 1


async def test_demo_listings_are_published_and_not_overdue(session: AsyncSession) -> None:
    await seed_demo_listings(session, NOW)
    for listing in await demo_listings_in_database(session):
        assert listing.status == ListingStatus.published
        assert listing.last_verified_at is not None and listing.last_verified_at < NOW
        assert listing.next_check_due is not None and listing.next_check_due > NOW


async def test_every_demo_listing_has_one_audit_entry_without_a_user(session: AsyncSession) -> None:
    await seed_demo_listings(session, NOW)
    entries = (await session.exec(select(AuditEntry))).all()
    assert len(entries) == len(DEMO_LISTINGS)
    assert all(entry.user_id is None and entry.action == "create" and entry.reference == "demo-seed"
               for entry in entries)


async def test_demo_listings_are_found_by_search_and_by_a_misspelled_name(session: AsyncSession) -> None:
    # The same check as "After the merge" in validation.md, on the test database.
    await seed_demo_listings(session, NOW)
    everything = await search_listings(session, SearchParams(q="DEMO"), NOW)
    assert everything.total == len(DEMO_LISTINGS)
    misspelled = await search_listings(session, SearchParams(q="After Hours Pharmcy"), NOW)  # one typo
    assert [item.name for item in misspelled.items] == ["DEMO – After Hours Pharmacy"]
    two_typos = await search_listings(session, SearchParams(q="Aftr Hours Pharmcy"), NOW)  # two typos
    assert [item.name for item in two_typos.items] == ["DEMO – After Hours Pharmacy"]
    assert (await search_listings(session, SearchParams(q="banana"), NOW)).total == 0


async def test_cleanup_deletes_exactly_the_demo_slugs_and_their_rows(
    session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    await seed_demo_listings(session, NOW)
    demo = (await demo_listings_in_database(session))[0]
    # Rows a demo listing could pick up later: a check, a report, one more audit entry.
    await listing_repository.add_verification_check(
        session, listing_id=demo.id, staff_id=demo_users[Role.verifier].id, method=CheckMethod.call,
        result=CheckResult.passed, person_reached=None, notes=None, checked_at=NOW,
    )
    await add_report(session, demo, "key-a", created_at=NOW)
    await audit_repository.add_entry(session, user_id=None, listing_id=demo.id, action="update")
    await session.commit()

    removed = await remove_demo_listings(session)

    assert removed["listings"] == len(DEMO_LISTINGS)
    assert removed["user_reports"] == 1 and removed["verification_checks"] == 1
    assert removed["audit_entries"] == len(DEMO_LISTINGS) + 1
    for model in ALL_TABLES:
        assert await count(session, model) == 0, model.__tablename__


async def test_cleanup_keeps_a_real_listing_whose_name_starts_with_demo_dash(session: AsyncSession) -> None:
    await seed_demo_listings(session, NOW)
    lookalike = await add_listing(session, "DEMO – Real Pharmacy")  # same prefix, different slug
    await add_report(session, lookalike, "key-a", created_at=NOW)
    await session.commit()
    await remove_demo_listings(session)
    remaining = (await session.exec(select(Listing))).all()
    assert [listing.name for listing in remaining] == ["DEMO – Real Pharmacy"]
    assert await count(session, UserReport) == 1
    assert await count(session, PhoneNumber) == 1


async def test_cleanup_keeps_other_listings_and_all_categories_and_users(
    session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    await add_listing(session, "Ogui Road Pharmacy", category_slug="hospital")
    await session.commit()
    await seed_demo_listings(session, NOW)
    categories_before = await count(session, Category)
    await remove_demo_listings(session)
    assert [listing.name for listing in (await session.exec(select(Listing))).all()] == ["Ogui Road Pharmacy"]
    assert await count(session, Category) == categories_before  # categories are reference data
    assert await count(session, User) == len(Role)


async def test_cleanup_twice_is_safe_and_reports_zero_left(session: AsyncSession) -> None:
    await seed_demo_listings(session, NOW)
    await remove_demo_listings(session)
    second = await remove_demo_listings(session)
    assert second["listings"] == 0
    assert await demo_listings_in_database(session) == []
    assert await demo_listings.count_demo_listings(session) == 0


async def test_cleanup_on_an_empty_database_does_nothing(session: AsyncSession) -> None:
    removed = await remove_demo_listings(session)
    assert set(removed.values()) == {0}


async def test_cleanup_is_one_transaction(session: AsyncSession, monkeypatch: pytest.MonkeyPatch) -> None:
    await seed_demo_listings(session, NOW)
    before = await table_counts(session)

    async def failing_commit() -> None:
        raise RuntimeError("the database went away")

    monkeypatch.setattr(session, "commit", failing_commit)
    with pytest.raises(RuntimeError):
        await remove_demo_listings(session)
    monkeypatch.undo()
    assert await table_counts(session) == before  # nothing was deleted


async def test_nothing_is_done_without_the_flags(session: AsyncSession) -> None:
    for environment in ({}, {SEED_FLAG: "false", REMOVE_FLAG: ""}):
        result = await apply_flags(session, environment, NOW)
        assert result.action == "nothing"
    assert await count(session, Listing) == 0


async def test_the_seed_flag_seeds_and_the_remove_flag_removes(session: AsyncSession) -> None:
    seeded = await apply_flags(session, {SEED_FLAG: "true"}, NOW)
    assert seeded.action == "seeded" and seeded.counts["listings"] == len(DEMO_LISTINGS)
    removed = await apply_flags(session, {REMOVE_FLAG: "true"}, NOW)
    assert removed.action == "removed" and removed.counts["listings"] == len(DEMO_LISTINGS)
    assert await count(session, Listing) == 0


@pytest.mark.parametrize("value", ["True", "1", "yes", "TRUE"])
async def test_any_value_other_than_true_does_nothing(session: AsyncSession, value: str) -> None:
    assert (await apply_flags(session, {SEED_FLAG: value, REMOVE_FLAG: value}, NOW)).action == "nothing"


async def test_when_both_flags_are_true_the_cleanup_runs_and_the_seed_does_not(session: AsyncSession) -> None:
    await seed_demo_listings(session, NOW)
    result = await apply_flags(session, {SEED_FLAG: "true", REMOVE_FLAG: "true"}, NOW)
    assert result.action == "removed"
    assert await demo_listings_in_database(session) == []


async def test_a_failure_is_logged_and_does_not_crash_the_start(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    def broken_session_factory() -> None:
        raise ConnectionError("cannot reach the database")

    monkeypatch.setattr(demo_listings, "session_factory", broken_session_factory)
    with caplog.at_level(logging.ERROR):
        await demo_listings.main({SEED_FLAG: "true"})  # must return normally
    assert "Demo listings step failed" in caplog.text


async def test_main_with_no_flags_does_not_even_open_the_database(monkeypatch: pytest.MonkeyPatch) -> None:
    def must_not_be_called() -> None:
        raise AssertionError("the database was opened")

    monkeypatch.setattr(demo_listings, "session_factory", must_not_be_called)
    await demo_listings.main({})


async def test_seed_with_a_recent_now_marks_listings_verified_three_days_ago(session: AsyncSession) -> None:
    await seed_demo_listings(session, NOW)
    for listing in await demo_listings_in_database(session):
        assert listing.last_verified_at == NOW - timedelta(days=3)
