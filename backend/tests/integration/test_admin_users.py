"""/admin/users: list, create, edit staff and provider accounts. Requirements: FR-41, FR-38, NFR-06, NFR-07.
Contract: specs/backend/api-spec.md, section 11 and its phase 10 clarifications. Decision C10 in
specs/2026-10-20-staff-screens/requirements.md.
"""

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.security import verify_password
from app.models import AuditEntry, Listing, User
from app.models.base import ListingStatus, Role
from app.repositories import user_repository
from tests.factories import add_listing
from tests.staff_helpers import bearer_for

pytestmark = pytest.mark.anyio

NEW_USER = {
    "name": "Ada Verifier",
    "email": "Ada.Verifier@Example.com",
    "phone": "08030000111",
    "role": "verifier",
    "password": "a-long-enough-password",
}


async def create(client: AsyncClient, admin: User, **changes: object):
    return await client.post("/admin/users", json={**NEW_USER, **changes}, headers=bearer_for(admin))


async def audit(session: AsyncSession) -> list[AuditEntry]:
    return list((await session.exec(select(AuditEntry).order_by(AuditEntry.id))).all())


@pytest.mark.parametrize("role", [Role.verifier, Role.editor, Role.provider])
async def test_only_an_admin_may_use_the_user_endpoints(
    client: AsyncClient, demo_users: dict[Role, User], role: Role
) -> None:
    headers = bearer_for(demo_users[role])
    assert (await client.get("/admin/users", headers=headers)).status_code == 403
    assert (await client.post("/admin/users", json=NEW_USER, headers=headers)).status_code == 403
    assert (await client.patch("/admin/users/1", json={"name": "X"}, headers=headers)).status_code == 403


async def test_without_a_login_the_answer_is_401(client: AsyncClient) -> None:
    assert (await client.get("/admin/users")).status_code == 401
    assert (await client.post("/admin/users", json=NEW_USER)).status_code == 401
    assert (await client.patch("/admin/users/1", json={})).status_code == 401


async def test_the_list_has_every_user_by_id_and_never_a_password_hash(
    client: AsyncClient, demo_users: dict[Role, User]
) -> None:
    response = await client.get("/admin/users", headers=bearer_for(demo_users[Role.admin]))
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 4
    assert [item["id"] for item in body["items"]] == sorted(item["id"] for item in body["items"])
    assert set(body["items"][0]) == {"id", "name", "email", "phone", "role", "is_active"}
    assert "password" not in response.text


async def test_an_admin_creates_a_user_of_any_role_who_can_then_be_read(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    admin = demo_users[Role.admin]
    for role in Role:
        response = await create(client, admin, email=f"{role.value}.new@example.com", role=role.value)
        assert response.status_code == 201, response.text
        body = response.json()
        assert body["role"] == role.value
        assert body["is_active"] is True
        assert body["phone"] == "+2348030000111"
        assert set(body) == {"id", "name", "email", "phone", "role", "is_active"}
    assert (await client.get("/admin/users", headers=bearer_for(admin))).json()["total"] == 8


async def test_the_email_is_lower_cased_the_password_is_hashed_and_it_works_for_the_login_check(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    response = await create(client, demo_users[Role.admin])
    assert response.json()["email"] == "ada.verifier@example.com"
    stored = await user_repository.get_by_email(session, "ada.verifier@example.com")
    assert stored.password_hash != NEW_USER["password"]
    assert verify_password(NEW_USER["password"], stored.password_hash)


async def test_a_duplicate_email_is_409_in_any_letter_case(
    client: AsyncClient, demo_users: dict[Role, User]
) -> None:
    admin = demo_users[Role.admin]
    assert (await create(client, admin)).status_code == 201
    assert (await create(client, admin, email="ada.verifier@example.com")).status_code == 409
    assert (await create(client, admin, email="ADA.VERIFIER@EXAMPLE.COM")).status_code == 409


@pytest.mark.parametrize(
    "changes",
    [
        {"password": "short"},
        {"password": "123456789"},
        {"password": "x" * 129},
        {"email": "not-an-email"},
        {"email": "a@b"},
        {"phone": "12345"},
        {"phone": ""},
        {"name": ""},
        {"name": "x" * 101},
        {"role": "superuser"},
    ],
)
async def test_bad_input_is_422_and_no_user_is_made(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], changes: dict
) -> None:
    response = await create(client, demo_users[Role.admin], **changes)
    assert response.status_code == 422, response.text
    assert await user_repository.get_by_email(session, "ada.verifier@example.com") is None


async def test_creating_writes_an_audit_entry_that_holds_no_password(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    admin = demo_users[Role.admin]
    await create(client, admin)
    [entry] = await audit(session)
    assert (entry.user_id, entry.listing_id, entry.action) == (admin.id, None, "user_create")
    text = " ".join(str(value) for value in entry.model_dump().values())
    assert NEW_USER["password"] not in text
    assert "ada.verifier@example.com" in text.lower()  # who was created is the point of the entry


async def test_an_admin_edits_name_role_phone_and_active_and_each_change_is_audited(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    admin, verifier = demo_users[Role.admin], demo_users[Role.verifier]
    response = await client.patch(
        f"/admin/users/{verifier.id}",
        json={"name": "New Name", "role": "editor", "phone": "0803 222 3333", "is_active": False},
        headers=bearer_for(admin),
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert (body["name"], body["role"], body["phone"], body["is_active"]) == (
        "New Name",
        "editor",
        "+2348032223333",
        False,
    )
    changed = {entry.field_changed: (entry.old_value, entry.new_value) for entry in await audit(session)}
    assert changed["name"] == ("Demo Verifier", "New Name")
    assert changed["role"] == ("verifier", "editor")
    assert changed["is_active"] == ("true", "false")
    assert changed["phone"] == (
        None,
        "changed",
    )  # a phone number is personal data: the entry says only "changed"
    assert {entry.action for entry in await audit(session)} == {"user_update"}


async def test_a_role_change_and_a_deactivation_apply_on_the_next_request(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    admin, editor = demo_users[Role.admin], demo_users[Role.editor]
    editor_headers = bearer_for(editor)
    assert (await client.get("/listings", headers=editor_headers)).status_code == 200
    await client.patch(f"/admin/users/{editor.id}", json={"role": "provider"}, headers=bearer_for(admin))
    assert (
        await client.get("/listings", headers=editor_headers)
    ).status_code == 403  # the role is read from the row
    await client.patch(
        f"/admin/users/{editor.id}", json={"role": "editor", "is_active": False}, headers=bearer_for(admin)
    )
    assert (await client.get("/listings", headers=editor_headers)).status_code == 403  # deactivated


async def test_a_new_password_is_hashed_never_returned_and_never_audited(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    admin, verifier = demo_users[Role.admin], demo_users[Role.verifier]
    response = await client.patch(
        f"/admin/users/{verifier.id}", json={"password": "another-long-password"}, headers=bearer_for(admin)
    )
    assert response.status_code == 200
    assert "password" not in response.text
    await session.refresh(verifier)
    assert verify_password("another-long-password", verifier.password_hash)
    [entry] = await audit(session)
    assert (entry.field_changed, entry.new_value) == ("password", "changed")
    assert "another-long-password" not in " ".join(str(v) for v in entry.model_dump().values())


async def test_a_short_new_password_is_422(client: AsyncClient, demo_users: dict[Role, User]) -> None:
    response = await client.patch(
        f"/admin/users/{demo_users[Role.verifier].id}",
        json={"password": "short"},
        headers=bearer_for(demo_users[Role.admin]),
    )
    assert response.status_code == 422


async def test_an_admin_cannot_deactivate_themselves_or_take_their_own_admin_role_away(
    client: AsyncClient, demo_users: dict[Role, User]
) -> None:
    admin = demo_users[Role.admin]
    headers = bearer_for(admin)
    assert (
        await client.patch(f"/admin/users/{admin.id}", json={"is_active": False}, headers=headers)
    ).status_code == 400
    assert (
        await client.patch(f"/admin/users/{admin.id}", json={"role": "editor"}, headers=headers)
    ).status_code == 400
    assert (
        await client.patch(f"/admin/users/{admin.id}", json={"name": "Renamed Admin"}, headers=headers)
    ).status_code == 200
    assert (
        await client.patch(
            f"/admin/users/{admin.id}", json={"is_active": True, "role": "admin"}, headers=headers
        )
    ).status_code == 200


async def test_an_unknown_user_is_404(client: AsyncClient, demo_users: dict[Role, User]) -> None:
    response = await client.patch(
        "/admin/users/99999", json={"name": "X"}, headers=bearer_for(demo_users[Role.admin])
    )
    assert response.status_code == 404


async def test_an_admin_links_a_provider_to_a_listing(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    admin, provider = demo_users[Role.admin], demo_users[Role.provider]
    listing = await add_listing(session, "Provider Clinic")
    await session.commit()
    response = await client.patch(
        f"/admin/users/{provider.id}", json={"listing_id": listing.id}, headers=bearer_for(admin)
    )
    assert response.status_code == 200, response.text
    await session.refresh(listing)
    assert listing.owner_id == provider.id
    entries = await audit(session)
    assert [(entry.listing_id, entry.field_changed, entry.new_value) for entry in entries] == [
        (listing.id, "owner_id", str(provider.id))
    ]


async def test_linking_works_again_for_the_same_provider_but_a_listing_owned_by_another_user_is_409(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    admin, provider = demo_users[Role.admin], demo_users[Role.provider]
    other = await user_repository.create(
        session,
        name="Other Provider",
        email="other@example.com",
        phone="+2340000000555",
        password_hash="x",
        role=Role.provider,
    )
    listing = await add_listing(session, "Provider Clinic")
    listing.owner_id = other.id
    session.add(listing)
    await session.commit()
    assert (
        await client.patch(
            f"/admin/users/{provider.id}", json={"listing_id": listing.id}, headers=bearer_for(admin)
        )
    ).status_code == 409
    await session.refresh(listing)
    assert listing.owner_id == other.id
    assert (
        await client.patch(
            f"/admin/users/{other.id}", json={"listing_id": listing.id}, headers=bearer_for(admin)
        )
    ).status_code == 200  # already theirs: nothing to change


async def test_a_listing_can_only_be_linked_to_a_provider_and_must_exist(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    admin = demo_users[Role.admin]
    listing = await add_listing(session, "Some Clinic", status=ListingStatus.draft)
    await session.commit()
    not_a_provider = demo_users[Role.verifier]
    assert (
        await client.patch(
            f"/admin/users/{not_a_provider.id}", json={"listing_id": listing.id}, headers=bearer_for(admin)
        )
    ).status_code == 422
    assert (
        await client.patch(
            f"/admin/users/{demo_users[Role.provider].id}",
            json={"listing_id": 99999},
            headers=bearer_for(admin),
        )
    ).status_code == 404
    refreshed = await session.get(Listing, listing.id)
    assert refreshed.owner_id is None


async def test_a_patch_with_nothing_to_change_writes_no_audit_entry(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    verifier = demo_users[Role.verifier]
    response = await client.patch(
        f"/admin/users/{verifier.id}",
        json={"name": verifier.name, "role": "verifier"},
        headers=bearer_for(demo_users[Role.admin]),
    )
    assert response.status_code == 200
    assert await audit(session) == []
