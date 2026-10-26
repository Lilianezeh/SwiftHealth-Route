"""The admin's list of accounts, with filters and a page size. Requirements: FR-55, US-18, NFR-06.
Spec: specs/backend/api-spec.md section 11, "Phase 4a", `GET /admin/users`. Admin only.
Every name, address and number here is fictional.
"""

from datetime import timedelta

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import User
from app.models.base import Role, utcnow
from app.repositories import user_repository
from tests.staff_helpers import bearer_for

pytestmark = pytest.mark.anyio

ROW_FIELDS = {
    "id", "name", "email", "phone", "role", "is_active", "two_factor_enabled", "approval_status",
    "last_login_at", "created_at", "email_verified_at", "phone_verified_at", "signup_note",
}


async def add_person(session: AsyncSession, name: str, email: str, role: Role, **changes: object) -> User:
    person = await user_repository.create(
        session, name=name, email=email, phone="+2348030000111", password_hash="x", role=role
    )
    for field, value in changes.items():
        setattr(person, field, value)
    session.add(person)
    await session.commit()
    return person


async def listing(client: AsyncClient, caller: User, query: str = "") -> dict:
    response = await client.get(f"/admin/users{query}", headers=bearer_for(caller))
    assert response.status_code == 200, response.text
    return response.json()


async def test_a_row_has_the_fields_the_admin_screens_need_and_no_secret(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    await add_person(
        session, "Bola Staff", "bola@example.com", Role.verifier,
        approval_status="pending", signup_note="Verifier in Ogui.", last_login_at=utcnow(),
    )

    body = await listing(client, demo_users[Role.admin], "?approval_status=pending")

    [row] = body["items"]
    assert set(row) == ROW_FIELDS
    assert (row["approval_status"], row["signup_note"]) == ("pending", "Verifier in Ogui.")
    assert row["last_login_at"] is not None and row["created_at"] is not None
    text = str(body).lower()
    assert "hash" not in text and "totp" not in text and "secret" not in text and "backup" not in text


async def test_with_no_filter_it_lists_everyone_by_id_with_the_total(
    client: AsyncClient, demo_users: dict[Role, User]
) -> None:
    body = await listing(client, demo_users[Role.admin])

    assert body["total"] == 4
    assert [row["id"] for row in body["items"]] == sorted(row["id"] for row in body["items"])


@pytest.mark.parametrize("role", ["admin", "editor", "verifier", "provider"])
async def test_filter_by_role(client: AsyncClient, demo_users: dict[Role, User], role: str) -> None:
    body = await listing(client, demo_users[Role.admin], f"?role={role}")

    assert [row["role"] for row in body["items"]] == [role]
    assert body["total"] == 1


async def test_filter_by_approval_status(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    await add_person(session, "Waiting One", "w1@example.com", Role.verifier, approval_status="pending")
    await add_person(session, "Waiting Two", "w2@example.com", Role.verifier, approval_status="pending")
    await add_person(session, "No One", "no@example.com", Role.verifier, approval_status="rejected")
    admin = demo_users[Role.admin]

    pending = await listing(client, admin, "?approval_status=pending")
    rejected = await listing(client, admin, "?approval_status=rejected")
    approved = await listing(client, admin, "?approval_status=approved")

    assert [row["name"] for row in pending["items"]] == ["Waiting One", "Waiting Two"]
    assert pending["total"] == 2
    assert [row["name"] for row in rejected["items"]] == ["No One"]
    assert approved["total"] == 4


async def test_filter_by_active_or_suspended(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    await add_person(session, "Gone Away", "gone@example.com", Role.editor, is_active=False)
    admin = demo_users[Role.admin]

    suspended = await listing(client, admin, "?is_active=false")
    active = await listing(client, admin, "?is_active=true")

    assert [row["name"] for row in suspended["items"]] == ["Gone Away"]
    assert active["total"] == 4


async def test_filters_combine(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    await add_person(session, "Waiting Verifier", "wv@example.com", Role.verifier, approval_status="pending")
    await add_person(session, "Waiting Editor", "we@example.com", Role.editor, approval_status="pending")

    body = await listing(client, demo_users[Role.admin], "?approval_status=pending&role=editor")

    assert [row["name"] for row in body["items"]] == ["Waiting Editor"]


async def test_search_text_matches_part_of_the_name_or_the_email_in_any_case(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    await add_person(session, "Ngozi Okafor", "ngozi.o@example.com", Role.editor)
    await add_person(session, "Chidi Eze", "chidi@clinic.example.com", Role.verifier)
    admin = demo_users[Role.admin]

    by_name = await listing(client, admin, "?q=OKAF")
    by_email = await listing(client, admin, "?q=Clinic.Example")

    assert [row["name"] for row in by_name["items"]] == ["Ngozi Okafor"]
    assert [row["name"] for row in by_email["items"]] == ["Chidi Eze"]


async def test_search_text_is_not_a_pattern(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    """A percent sign or an underscore in the text means itself, so it cannot be used to list everyone."""
    await add_person(session, "Plain Name", "plain@example.com", Role.editor)
    admin = demo_users[Role.admin]

    assert (await listing(client, admin, "?q=%25"))["total"] == 0
    assert (await listing(client, admin, "?q=_"))["total"] == 0


async def test_page_size_and_offset_with_the_total_of_the_whole_match(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    for number in range(6):
        await add_person(session, f"Person {number}", f"p{number}@example.com", Role.verifier)
    admin = demo_users[Role.admin]

    first = await listing(client, admin, "?limit=4")
    second = await listing(client, admin, "?limit=4&offset=4")
    last = await listing(client, admin, "?limit=4&offset=8")

    assert [first["total"], second["total"], last["total"]] == [10, 10, 10]
    assert [len(first["items"]), len(second["items"]), len(last["items"])] == [4, 4, 2]
    ids = [row["id"] for page in (first, second, last) for row in page["items"]]
    assert ids == sorted(ids) and len(set(ids)) == 10


@pytest.mark.parametrize(
    "query",
    ["?limit=0", "?limit=201", "?offset=-1", "?role=king", "?approval_status=maybe", "?is_active=perhaps"],
)
async def test_bad_filter_values_are_422(
    client: AsyncClient, demo_users: dict[Role, User], query: str
) -> None:
    response = await client.get(f"/admin/users{query}", headers=bearer_for(demo_users[Role.admin]))

    assert response.status_code == 422


async def test_the_default_page_is_100_accounts(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    for number in range(105):
        session.add(
            User(
                name=f"Bulk {number}", email=f"bulk{number}@example.com", phone=None, password_hash="x",
                role=Role.verifier, created_at=utcnow() - timedelta(days=1),
            )
        )
    await session.commit()

    body = await listing(client, demo_users[Role.admin])

    assert body["total"] == 109 and len(body["items"]) == 100


@pytest.mark.parametrize("role", [Role.editor, Role.verifier, Role.provider])
async def test_only_an_admin_may_list(client: AsyncClient, demo_users: dict[Role, User], role: Role) -> None:
    response = await client.get("/admin/users", headers=bearer_for(demo_users[role]))

    assert response.status_code == 403


async def test_anonymous_is_401(client: AsyncClient) -> None:
    assert (await client.get("/admin/users")).status_code == 401
