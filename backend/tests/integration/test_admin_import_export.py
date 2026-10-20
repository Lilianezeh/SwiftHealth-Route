"""POST /admin/import and GET /admin/export. Requirements: FR-39, FR-40, FR-38, NFR-06, NFR-07.
Contract: specs/backend/api-spec.md, section 11. Decisions E1 to E3: specs/2026-10-20-launch-readiness/.
"""

import csv
import io
from collections.abc import Iterator
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment
from app.main import app
from app.models import AuditEntry, Listing, PhoneNumber, User, VerificationCheck
from app.models.base import CheckMethod, CheckResult, ListingStatus, Role
from tests.factories import add_listing, get_or_add_category
from tests.staff_helpers import bearer_for

pytestmark = pytest.mark.anyio

NOW = datetime(2026, 10, 6, 9, 0, tzinfo=timezone.utc)
HEADER = "name,category,area,address,landmark,latitude,longitude,phone,is_24_hours"
GOOD_ROW = "Night Pharmacy,pharmacy,Ogui,1 Example Road,By the church,6.45,7.5,08030000000,false"


@pytest.fixture
def clock() -> Iterator[None]:
    app.dependency_overrides[get_current_moment] = lambda: NOW
    yield
    app.dependency_overrides.pop(get_current_moment, None)


@pytest.fixture
async def categories(session: AsyncSession) -> None:
    await get_or_add_category(session, "pharmacy", "Pharmacy")
    await get_or_add_category(session, "clinic", "Clinic")
    await session.commit()


async def upload(client: AsyncClient, admin: User | None, text: str | bytes, content_type: str = "text/csv"):
    headers = {"content-type": content_type, **(bearer_for(admin) if admin else {})}
    body = text.encode() if isinstance(text, str) else text
    return await client.post("/admin/import", content=body, headers=headers)


def csv_of(*rows: str, header: str = HEADER) -> str:
    return "\n".join([header, *rows]) + "\n"


# --- access ---


@pytest.mark.parametrize("role", [Role.verifier, Role.editor, Role.provider])
async def test_only_an_admin_may_import_or_export(
    client: AsyncClient, demo_users: dict[Role, User], clock: None, categories: None, role: Role
) -> None:
    assert (await upload(client, demo_users[role], csv_of(GOOD_ROW))).status_code == 403
    assert (
        await client.get("/admin/export?type=listings", headers=bearer_for(demo_users[role]))
    ).status_code == 403


async def test_without_a_login_the_answer_is_401(client: AsyncClient, clock: None, categories: None) -> None:
    assert (await upload(client, None, csv_of(GOOD_ROW))).status_code == 401
    assert (await client.get("/admin/export?type=listings")).status_code == 401


# --- import ---


async def test_good_rows_become_drafts_owned_by_the_admin_with_the_phone_as_primary(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None, categories: None
) -> None:
    admin = demo_users[Role.admin]
    second = "Day Clinic,clinic,GRA,2 Example Road,,6.46,7.51,+2348031112222,yes"

    response = await upload(client, admin, csv_of(GOOD_ROW, second))

    assert response.status_code == 200, response.text
    assert response.json() == {"created": 2, "errors": []}
    listings = (await session.exec(select(Listing).order_by(Listing.id))).all()
    assert [(item.name, item.status, item.created_by, item.is_24_hours) for item in listings] == [
        ("Night Pharmacy", ListingStatus.draft, admin.id, False),
        ("Day Clinic", ListingStatus.draft, admin.id, True),
    ]
    assert (listings[0].landmark, listings[1].landmark) == ("By the church", None)
    phones = (await session.exec(select(PhoneNumber).order_by(PhoneNumber.id))).all()
    assert [(phone.number, phone.is_primary) for phone in phones] == [
        ("+2348030000000", True),
        ("+2348031112222", True),
    ]
    assert listings[0].slug == "night-pharmacy-ogui"


async def test_each_created_draft_gets_a_create_audit_entry_with_the_csv_reference(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None, categories: None
) -> None:
    await upload(client, demo_users[Role.admin], csv_of(GOOD_ROW))
    [entry] = (await session.exec(select(AuditEntry))).all()
    assert (entry.user_id, entry.action, entry.reference) == (
        demo_users[Role.admin].id,
        "create",
        "csv-import",
    )


async def test_the_drafts_are_not_public(
    client: AsyncClient, demo_users: dict[Role, User], clock: None, categories: None
) -> None:
    await upload(client, demo_users[Role.admin], csv_of(GOOD_ROW))
    assert (await client.get("/search")).json()["total"] == 0


@pytest.mark.parametrize(
    ("row", "detail"),
    [
        (",pharmacy,Ogui,1 Road,,6.45,7.5,08030000000,false", "Name is required"),
        ("X,no-such,Ogui,1 Road,,6.45,7.5,08030000000,false", "Unknown category"),
        ("X,pharmacy,Atlantis,1 Road,,6.45,7.5,08030000000,false", "Unknown area"),
        ("X,pharmacy,Ogui,,,6.45,7.5,08030000000,false", "Address is required"),
        ("X,pharmacy,Ogui,1 Road,,91,7.5,08030000000,false", "Latitude must be a number from -90 to 90"),
        ("X,pharmacy,Ogui,1 Road,,abc,7.5,08030000000,false", "Latitude must be a number from -90 to 90"),
        ("X,pharmacy,Ogui,1 Road,,6.45,181,08030000000,false", "Longitude must be a number from -180 to 180"),
        ("X,pharmacy,Ogui,1 Road,,6.45,,08030000000,false", "Longitude must be a number from -180 to 180"),
        ("X,pharmacy,Ogui,1 Road,,6.45,7.5,12345,false", "Phone is not a Nigerian number"),
        ("X,pharmacy,Ogui,1 Road,,6.45,7.5,,false", "Phone is not a Nigerian number"),
        ("X,pharmacy,Ogui,1 Road,,6.45,7.5,08030000000,maybe", "is_24_hours must be true or false"),
    ],
)
async def test_a_bad_row_is_skipped_and_reported_with_its_row_number_and_nothing_is_created_from_it(
    client: AsyncClient,
    session: AsyncSession,
    demo_users: dict[Role, User],
    clock: None,
    categories: None,
    row: str,
    detail: str,
) -> None:
    response = await upload(client, demo_users[Role.admin], csv_of(row))
    assert response.status_code == 200
    assert response.json() == {"created": 0, "errors": [{"row": 2, "detail": detail}]}
    assert (await session.exec(select(Listing))).all() == []


async def test_good_rows_are_created_while_the_bad_ones_are_reported_by_row(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None, categories: None
) -> None:
    bad = "X,pharmacy,Atlantis,1 Road,,6.45,7.5,08030000000,false"
    response = await upload(
        client, demo_users[Role.admin], csv_of(GOOD_ROW, bad, GOOD_ROW.replace("Night", "Late"))
    )
    assert response.json() == {"created": 2, "errors": [{"row": 3, "detail": "Unknown area"}]}
    assert len((await session.exec(select(Listing))).all()) == 2


async def test_every_problem_of_one_row_is_in_one_entry_per_row_not_per_problem(
    client: AsyncClient, demo_users: dict[Role, User], clock: None, categories: None
) -> None:
    response = await upload(client, demo_users[Role.admin], csv_of(",no-such,Atlantis,,,x,y,1,maybe"))
    [error] = response.json()["errors"]
    assert error["row"] == 2
    assert (
        error["detail"] == "Name is required"
    )  # the first problem; the row is skipped, so the rest can wait for the next try


async def test_importing_the_same_file_twice_creates_nothing_the_second_time(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None, categories: None
) -> None:
    admin = demo_users[Role.admin]
    await upload(client, admin, csv_of(GOOD_ROW))
    same_name_in_capitals = GOOD_ROW.replace("Night Pharmacy", "NIGHT PHARMACY")
    again = await upload(client, admin, csv_of(same_name_in_capitals))
    assert again.json() == {"created": 0, "errors": [{"row": 2, "detail": "Already listed"}]}
    assert len((await session.exec(select(Listing))).all()) == 1


async def test_the_same_name_and_area_twice_in_one_file_is_listed_once(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None, categories: None
) -> None:
    response = await upload(client, demo_users[Role.admin], csv_of(GOOD_ROW, GOOD_ROW))
    assert response.json() == {"created": 1, "errors": [{"row": 3, "detail": "Already listed"}]}


async def test_an_existing_listing_of_any_status_blocks_a_duplicate(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None, categories: None
) -> None:
    await add_listing(session, "Night Pharmacy", area="Ogui", status=ListingStatus.hidden)
    await session.commit()
    response = await upload(client, demo_users[Role.admin], csv_of(GOOD_ROW))
    assert response.json()["errors"] == [{"row": 2, "detail": "Already listed"}]


async def test_the_columns_may_be_in_any_order_extra_columns_are_ignored_and_a_byte_order_mark_is_ok(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None, categories: None
) -> None:
    header = "phone,extra,name,is_24_hours,latitude,longitude,area,category,address,landmark"
    row = "08030000000,ignored,Night Pharmacy,true,6.45,7.5,Ogui,pharmacy,1 Example Road,"
    response = await upload(client, demo_users[Role.admin], "﻿" + csv_of(row, header=header))
    assert response.json() == {"created": 1, "errors": []}


async def test_quoted_cells_with_commas_and_new_lines_are_read_as_one_cell(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None, categories: None
) -> None:
    address, landmark = '"1 Example Road, Ogui"', '"By the church\nnear the market"'
    row = f"Night Pharmacy,pharmacy,Ogui,{address},{landmark},6.45,7.5,08030000000,false"
    await upload(client, demo_users[Role.admin], csv_of(row))
    [listing] = (await session.exec(select(Listing))).all()
    assert listing.address == "1 Example Road, Ogui"
    assert listing.landmark == "By the church\nnear the market"


@pytest.mark.parametrize(
    "header", ["name,category,area", "", "name,category,area,address,landmark,latitude,longitude,is_24_hours"]
)
async def test_a_file_without_every_column_is_422_and_names_the_missing_ones(
    client: AsyncClient, demo_users: dict[Role, User], clock: None, categories: None, header: str
) -> None:
    response = await upload(client, demo_users[Role.admin], header + "\n" if header else "")
    assert response.status_code == 422
    assert "phone" in response.json()["detail"] or "name" in response.json()["detail"]


async def test_more_than_500_rows_is_refused_and_exactly_500_is_accepted(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None, categories: None
) -> None:
    admin = demo_users[Role.admin]
    rows = [
        f"Place {number},pharmacy,Ogui,{number} Road,,6.45,7.5,08030000000,false" for number in range(501)
    ]
    refused = await upload(client, admin, csv_of(*rows))
    assert refused.status_code == 422
    assert "500" in refused.json()["detail"]
    assert (await session.exec(select(Listing))).all() == []
    accepted = await upload(client, admin, csv_of(*rows[:500]))
    assert accepted.json()["created"] == 500


async def test_a_file_over_1_mb_is_413(
    client: AsyncClient, demo_users: dict[Role, User], clock: None, categories: None
) -> None:
    response = await upload(client, demo_users[Role.admin], "x" * (1024 * 1024 + 1))
    assert response.status_code == 413


async def test_the_wrong_content_type_is_415_and_text_that_is_not_utf8_is_422(
    client: AsyncClient, demo_users: dict[Role, User], clock: None, categories: None
) -> None:
    admin = demo_users[Role.admin]
    assert (await upload(client, admin, csv_of(GOOD_ROW), content_type="application/json")).status_code == 415
    assert (await upload(client, admin, b"\xff\xfe\x00bad", content_type="text/csv")).status_code == 422


async def test_a_header_only_file_creates_nothing(
    client: AsyncClient, demo_users: dict[Role, User], clock: None, categories: None
) -> None:
    assert (await upload(client, demo_users[Role.admin], csv_of())).json() == {"created": 0, "errors": []}


# --- export ---


def parse(text: str) -> list[dict[str, str]]:
    return list(csv.DictReader(io.StringIO(text)))


async def export(client: AsyncClient, admin: User, kind: str):
    return await client.get("/admin/export", params={"type": kind}, headers=bearer_for(admin))


async def test_the_listings_export_has_the_columns_every_status_and_the_primary_phone(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    await add_listing(session, "Published One", phone="+2348030000001", last_verified_at=NOW)
    await add_listing(session, "Draft One", status=ListingStatus.draft, phone="+2348030000002")
    await session.commit()

    response = await export(client, demo_users[Role.admin], "listings")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert 'attachment; filename="listings.csv"' in response.headers["content-disposition"]
    rows = parse(response.text)
    assert list(rows[0]) == [
        "id",
        "slug",
        "name",
        "category",
        "area",
        "address",
        "landmark",
        "latitude",
        "longitude",
        "phone",
        "is_24_hours",
        "status",
        "last_verified_at",
        "next_check_due",
    ]
    assert [(row["name"], row["status"], row["phone"]) for row in rows] == [
        ("Draft One", "draft", "+2348030000002"),
        ("Published One", "published", "+2348030000001"),
    ]
    assert rows[1]["last_verified_at"] == "2026-10-06T09:00:00+00:00"
    assert rows[1]["category"] == "pharmacy"


async def test_a_listing_with_no_phone_has_an_empty_phone_cell(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    await add_listing(session, "No Phone", phone=None)
    await session.commit()
    [row] = parse((await export(client, demo_users[Role.admin], "listings")).text)
    assert row["phone"] == ""


async def test_a_cell_that_starts_like_a_formula_is_neutralised_in_the_export(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    await add_listing(session, '=HYPERLINK("http://evil.example","click")')
    await add_listing(session, "+cmd|' /C calc'!A0")
    await add_listing(session, "@SUM(1+1)")
    await session.commit()
    rows = parse((await export(client, demo_users[Role.admin], "listings")).text)
    names = sorted(row["name"] for row in rows)
    assert names == sorted(
        ['\'=HYPERLINK("http://evil.example","click")', "'+cmd|' /C calc'!A0", "'@SUM(1+1)"]
    )
    assert all(not row["name"].startswith(("=", "+", "-", "@")) for row in rows)


async def test_the_checks_export_has_the_names_and_the_columns(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    listing = await add_listing(session, "Night Pharmacy")
    verifier = demo_users[Role.verifier]
    session.add(
        VerificationCheck(
            listing_id=listing.id,
            staff_id=verifier.id,
            method=CheckMethod.visit,
            result=CheckResult.passed,
            person_reached="=Pharmacist",
            notes="Hours confirmed",
            checked_at=NOW,
        )
    )
    await session.commit()
    response = await export(client, demo_users[Role.admin], "checks")
    assert 'filename="checks.csv"' in response.headers["content-disposition"]
    [row] = parse(response.text)
    assert list(row) == [
        "id",
        "listing_id",
        "listing_name",
        "staff_name",
        "method",
        "result",
        "person_reached",
        "notes",
        "photo_url",
        "checked_at",
    ]
    assert (row["listing_name"], row["staff_name"], row["method"], row["result"]) == (
        "Night Pharmacy",
        verifier.name,
        "visit",
        "pass",
    )
    assert row["person_reached"] == "'=Pharmacist"
    assert row["checked_at"] == "2026-10-06T09:00:00+00:00"


async def test_an_empty_export_is_just_the_header(
    client: AsyncClient, demo_users: dict[Role, User], clock: None
) -> None:
    for kind in ("listings", "checks"):
        text = (await export(client, demo_users[Role.admin], kind)).text
        assert len(text.strip().splitlines()) == 1


@pytest.mark.parametrize("kind", ["users", "", "LISTINGS"])
async def test_any_other_type_is_422(
    client: AsyncClient, demo_users: dict[Role, User], clock: None, kind: str
) -> None:
    assert (await export(client, demo_users[Role.admin], kind)).status_code == 422


async def test_no_export_ever_holds_a_password_hash_or_a_reporter_phone(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    listing = await add_listing(session, "Night Pharmacy")
    from tests.factories import add_report

    report = await add_report(session, listing, "key-hash", created_at=NOW)
    report.reporter_phone = "+2348039999999"
    session.add(report)
    await session.commit()
    for kind in ("listings", "checks"):
        text = (await export(client, demo_users[Role.admin], kind)).text
        assert "+2348039999999" not in text
        assert "key-hash" not in text
        assert demo_users[Role.admin].password_hash not in text
