"""An admin records that they phoned the person and the phone is theirs. Requirements: FR-48, FR-49, FR-55.
Spec: specs/backend/api-spec.md section 4c, "POST /admin/users/{user_id}/confirm-phone-by-call"; decision
D20 of specs/2026-10-23-accounts-and-facility-ownership/ (owner, 2026-10-25).

Without Termii a sign-up leaves the phone not confirmed. `POST /admin/users/{id}/confirm-phone-by-call`
(admin only, role read from the database row) sets `phone_verified_at` and writes one audit entry that
holds no phone number. It approves nothing (that is Phase 4a). Every name, address and number is fictional.
"""

from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.models import AuditEntry, User
from app.models.base import Role
from app.repositories import user_repository
from tests.staff_helpers import bearer_for

pytestmark = pytest.mark.anyio


async def waiting_person(
    session: AsyncSession, *, email_confirmed: bool = True, phone: str | None = "+2348030000999"
) -> User:
    """A provider who signed up without Termii: the email is confirmed, the phone is not."""
    person = await user_repository.create(
        session,
        name="Ada Owner",
        email="ada.owner@example.com",
        phone=phone,
        password_hash="x",
        role=Role.provider,
        confirmed=False,
    )
    person.email_verified_at = datetime.now(timezone.utc) if email_confirmed else None
    session.add(person)
    await session.commit()
    return person


async def confirm_by_call(client: AsyncClient, caller: User | None, target_id: int):
    headers = bearer_for(caller) if caller else {}
    return await client.post(f"/admin/users/{target_id}/confirm-phone-by-call", headers=headers)


async def audit_entries(session: AsyncSession) -> list[AuditEntry]:
    query = select(AuditEntry).where(AuditEntry.action == "phone_confirmed_by_call")
    return list((await session.exec(query)).all())


async def test_an_admin_confirms_the_phone_and_it_is_in_the_audit_log_without_the_number(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    admin = demo_users[Role.admin]
    person = await waiting_person(session)

    response = await confirm_by_call(client, admin, person.id)

    assert (response.status_code, response.json()) == (200, {"phone_confirmed": True})
    await session.refresh(person)
    assert person.phone_verified_at is not None
    [entry] = await audit_entries(session)
    assert (entry.user_id, entry.listing_id, entry.field_changed) == (admin.id, None, "phone")
    assert entry.new_value == f"confirmed for user {person.id}"
    text = " ".join(str(value) for value in entry.model_dump().values())
    assert "0999" not in text and "ada.owner@example.com" not in text


async def test_asking_again_changes_nothing_and_writes_no_second_entry(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    person = await waiting_person(session)
    await confirm_by_call(client, demo_users[Role.admin], person.id)
    await session.refresh(person)
    first_time = person.phone_verified_at

    again = await confirm_by_call(client, demo_users[Role.admin], person.id)

    assert (again.status_code, again.json()) == (200, {"phone_confirmed": True})
    await session.refresh(person)
    assert person.phone_verified_at == first_time
    assert len(await audit_entries(session)) == 1


async def test_an_unknown_account_is_404(client: AsyncClient, demo_users: dict[Role, User]) -> None:
    response = await confirm_by_call(client, demo_users[Role.admin], 99999)

    assert (response.status_code, response.json()["detail"]) == (404, "User not found")


async def test_an_account_whose_email_is_not_confirmed_is_409_and_nothing_changes(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    person = await waiting_person(session, email_confirmed=False)

    response = await confirm_by_call(client, demo_users[Role.admin], person.id)

    assert (response.status_code, response.json()["detail"]) == (409, "Confirm the email first.")
    await session.refresh(person)
    assert person.phone_verified_at is None
    assert await audit_entries(session) == []


async def test_an_account_with_no_phone_is_409(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    person = await waiting_person(session, phone=None)

    response = await confirm_by_call(client, demo_users[Role.admin], person.id)

    assert (response.status_code, response.json()["detail"]) == (409, "This account has no phone number.")
    assert await audit_entries(session) == []


@pytest.mark.parametrize("role", [Role.editor, Role.verifier, Role.provider])
async def test_only_an_admin_may_do_it(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession, role: Role
) -> None:
    person = await waiting_person(session)

    response = await confirm_by_call(client, demo_users[role], person.id)

    assert response.status_code == 403
    await session.refresh(person)
    assert person.phone_verified_at is None


async def test_without_a_login_it_is_401(client: AsyncClient, session: AsyncSession) -> None:
    person = await waiting_person(session)

    assert (await confirm_by_call(client, None, person.id)).status_code == 401


async def test_an_admin_who_is_not_ready_is_refused_even_with_a_valid_token(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    admin = demo_users[Role.admin]
    admin.is_active = False
    session.add(admin)
    await session.commit()
    person = await waiting_person(session)

    assert (await confirm_by_call(client, admin, person.id)).status_code == 403


async def test_it_does_not_approve_a_staff_account(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    person = await waiting_person(session)
    person.role, person.approval_status = Role.verifier, "pending"
    session.add(person)
    await session.commit()

    await confirm_by_call(client, demo_users[Role.admin], person.id)

    await session.refresh(person)
    assert person.approval_status == "pending"


async def test_after_the_call_a_person_is_ready_when_termii_goes_live(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """With Termii live the phone must be confirmed to log in: the call is what confirms it."""
    person = await waiting_person(session)
    monkeypatch.setattr(settings, "termii_api_key", "key-set-for-tests")
    me_before = await client.get("/auth/me", headers=bearer_for(person))
    assert (me_before.status_code, me_before.json()["detail"]) == (403, "Confirm your phone number first.")

    await confirm_by_call(client, demo_users[Role.admin], person.id)

    assert (await client.get("/auth/me", headers=bearer_for(person))).status_code == 200
