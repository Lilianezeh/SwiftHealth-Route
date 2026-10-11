"""The is_whatsapp flag of a phone number. Requirement: FR-47 (the WhatsApp button comes in phase 6b).

Decision 10 in specs/2026-10-11-listing-detail-api/requirements.md: the column is NOT NULL and false by
default, and nothing that is seeded or demoed is ever marked as a WhatsApp number (a fictional number can
belong to a real person).
"""
from datetime import datetime, timezone

import pytest
from sqlalchemy import CursorResult, text
from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import PhoneNumber
from seed.demo_listings import seed_demo_listings
from seed.seed import run
from tests.factories import add_listing
from tests.revision_loader import BACKEND_FOLDER
from tests.unit.test_seed_data import TEST_PASSWORDS

NOW = datetime(2026, 10, 11, 12, 0, tzinfo=timezone.utc)


async def run_sql(session: AsyncSession, sql: str, **parameters: object) -> CursorResult:
    """Raw SQL in the session's transaction, through its connection (SQLModel deprecates session.execute)."""
    connection = await session.connection()
    return await connection.execute(text(sql), parameters)


async def is_whatsapp_values(session: AsyncSession) -> list[bool]:
    return [phone.is_whatsapp for phone in (await session.exec(select(PhoneNumber))).all()]


def test_a_new_phone_number_is_not_a_whatsapp_number_by_default() -> None:
    phone = PhoneNumber(listing_id=1, number="+2340000000001")

    assert phone.is_whatsapp is False


@pytest.mark.anyio
async def test_a_phone_saved_without_is_whatsapp_is_false_in_the_database(session: AsyncSession) -> None:
    listing = await add_listing(session, "Night Pharmacy A")

    # A raw insert that does not name the column: the database default fills it, not the Python model.
    await run_sql(
        session,
        "INSERT INTO phone_numbers (listing_id, number, is_primary) VALUES (:listing_id, :number, false)",
        listing_id=listing.id,
        number="+2340000000002",
    )

    result = await run_sql(session, "SELECT is_whatsapp FROM phone_numbers WHERE number = '+2340000000002'")
    assert result.scalar_one() is False


@pytest.mark.anyio
async def test_is_whatsapp_true_is_saved_and_read_back(session: AsyncSession) -> None:
    listing = await add_listing(session, "Night Pharmacy A", phone=None)
    session.add(PhoneNumber(listing_id=listing.id, number="+2340000000003", is_whatsapp=True))
    session.add(PhoneNumber(listing_id=listing.id, number="+2340000000004"))
    await session.flush()

    phones = {phone.number: phone.is_whatsapp for phone in (await session.exec(select(PhoneNumber))).all()}

    assert phones == {"+2340000000003": True, "+2340000000004": False}


@pytest.mark.anyio
async def test_the_column_is_not_null_with_a_default_of_false_and_the_model_says_the_same(
    session: AsyncSession,
) -> None:
    listing = await add_listing(session, "Night Pharmacy A")
    row = (
        await run_sql(
            session,
            "SELECT data_type, is_nullable, column_default FROM information_schema.columns "
            "WHERE table_name = 'phone_numbers' AND column_name = 'is_whatsapp'",
        )
    ).one()
    model_column = PhoneNumber.__table__.c.is_whatsapp

    assert tuple(row) == ("boolean", "NO", "false")
    assert model_column.nullable is False
    assert str(model_column.server_default.arg) == "false"

    with pytest.raises(IntegrityError):  # a null is refused by the database itself
        async with session.begin_nested():
            await run_sql(
                session,
                "UPDATE phone_numbers SET is_whatsapp = NULL WHERE listing_id = :listing_id",
                listing_id=listing.id,
            )


@pytest.mark.anyio
async def test_no_seeded_listing_phone_is_marked_whatsapp(session: AsyncSession) -> None:
    await run(session, TEST_PASSWORDS)

    values = await is_whatsapp_values(session)

    assert values  # the check really sees the seeded numbers
    assert not any(values)


@pytest.mark.anyio
async def test_no_demo_listing_phone_is_marked_whatsapp(session: AsyncSession) -> None:
    await seed_demo_listings(session, NOW)

    values = await is_whatsapp_values(session)

    assert values
    assert not any(values)


def test_the_seed_and_demo_code_never_set_is_whatsapp() -> None:
    offenders = [
        str(file.relative_to(BACKEND_FOLDER))
        for file in sorted((BACKEND_FOLDER / "seed").glob("*.py"))
        if "is_whatsapp" in file.read_text()
    ]

    assert offenders == []
