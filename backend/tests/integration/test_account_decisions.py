"""The admin decides on accounts: approve, reject, suspend, reactivate.
Requirements: FR-49, FR-55, FR-38, US-18, NFR-06, NFR-07.
Spec: specs/backend/api-spec.md section 11, "Phase 4a"; decisions D6 and D20 of
specs/2026-10-23-accounts-and-facility-ownership/.

Every route is admin only (the role is read from the database row). A staff sign-up is `pending` and can
do nothing; the admin approves it as an editor or a verifier (never as an admin) once its email and phone
are confirmed, or rejects it. A suspended account is refused on its next request. Nothing is ever deleted.
Every name, address and number here is fictional.
"""

import logging

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.integrations import resend
from app.models import AuditEntry, User
from app.models.base import Role, utcnow
from app.repositories import user_repository
from tests.integration.test_auth import SmsRecorder, start_login
from tests.staff_helpers import bearer_for

pytestmark = pytest.mark.anyio

WAITING = "This account is waiting for approval by an admin."
NOT_APPROVED = "This account was not approved."


class MailBox:
    """Stands in for Resend: what was sent, to whom."""

    def __init__(self) -> None:
        self.sent: list[tuple[str, str, str]] = []
        self.error: Exception | None = None

    async def send_email(self, to: str, subject: str, body: str, **_: object) -> None:
        if self.error:
            raise self.error
        self.sent.append((to, subject, body))


@pytest.fixture
def mailbox(monkeypatch: pytest.MonkeyPatch) -> MailBox:
    box = MailBox()
    monkeypatch.setattr(resend, "send_email", box.send_email)
    return box


async def pending_staff(
    session: AsyncSession,
    email: str = "bola.staff@example.com",
    *,
    email_confirmed: bool = True,
    phone_confirmed: bool = True,
) -> User:
    """A staff sign-up waiting for approval, as the sign-up makes it: a verifier, `pending`."""
    person = await user_repository.create(
        session,
        name="Bola Staff",
        email=email,
        phone="+2348030000456",
        password_hash="x",
        role=Role.verifier,
        confirmed=False,
        approval_status="pending",
        signup_note="Verifier at the clinic in Ogui.",
    )
    now = utcnow()
    person.email_verified_at = now if email_confirmed else None
    person.phone_verified_at = now if phone_confirmed else None
    session.add(person)
    await session.commit()
    return person


async def decide(
    client: AsyncClient, caller: User | None, user_id: int, action: str, body: dict | None = None
):
    headers = bearer_for(caller) if caller else {}
    return await client.post(f"/admin/users/{user_id}/{action}", headers=headers, json=body)


async def entries(session: AsyncSession, action: str) -> list[AuditEntry]:
    query = select(AuditEntry).where(AuditEntry.action == action)
    query = query.order_by(AuditEntry.id)  # type: ignore[arg-type]
    return list((await session.exec(query)).all())


async def reload(session: AsyncSession, person: User) -> User:
    await session.refresh(person)
    return person


# --- who may decide ---


@pytest.mark.parametrize("action", ["approve", "reject", "suspend", "reactivate"])
@pytest.mark.parametrize("role", [Role.editor, Role.verifier, Role.provider])
async def test_only_an_admin_may_decide(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession, action: str, role: Role
) -> None:
    person = await pending_staff(session)
    body = {"approve": {"role": "editor"}, "suspend": {"reason": "x"}}.get(action, {})

    response = await decide(client, demo_users[role], person.id, action, body)

    assert response.status_code == 403
    assert (await reload(session, person)).approval_status == "pending"


@pytest.mark.parametrize("action", ["approve", "reject", "suspend", "reactivate"])
async def test_without_a_login_it_is_401(client: AsyncClient, session: AsyncSession, action: str) -> None:
    person = await pending_staff(session)

    assert (await decide(client, None, person.id, action, {})).status_code == 401


async def test_an_admin_who_is_suspended_or_not_ready_is_refused_even_with_a_valid_token(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    admin = demo_users[Role.admin]
    admin.is_active = False
    session.add(admin)
    await session.commit()
    person = await pending_staff(session)

    assert (await decide(client, admin, person.id, "approve", {"role": "editor"})).status_code == 403


# --- approve ---


@pytest.mark.parametrize("role", ["editor", "verifier"])
async def test_approve_makes_a_pending_staff_account_an_editor_or_a_verifier_who_can_then_log_in(
    client: AsyncClient,
    demo_users: dict[Role, User],
    session: AsyncSession,
    mailbox: MailBox,
    monkeypatch: pytest.MonkeyPatch,
    demo_password_hash: str,
    role: str,
) -> None:
    sms = SmsRecorder()
    monkeypatch.setattr("app.services.auth_service.send_sms", sms.send_sms)
    person = await pending_staff(session)
    person.password_hash = demo_password_hash
    session.add(person)
    await session.commit()
    before = await start_login(client, person.email)
    assert (before.status_code, before.json()["detail"]) == (403, WAITING)

    response = await decide(client, demo_users[Role.admin], person.id, "approve", {"role": role})

    assert response.status_code == 200, response.text
    body = response.json()
    assert (body["role"], body["approval_status"], body["is_active"]) == (role, "approved", True)
    assert (await reload(session, person)).role == Role(role)
    after = await start_login(client, person.email)
    assert after.status_code == 200  # the code goes out: the account is ready
    assert "password" not in response.text and "hash" not in response.text


@pytest.mark.parametrize("role", ["admin", "provider", "nonsense"])
async def test_approve_never_makes_an_admin_or_a_provider(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession, role: str
) -> None:
    person = await pending_staff(session)

    response = await decide(client, demo_users[Role.admin], person.id, "approve", {"role": role})

    assert response.status_code == 422
    assert (await reload(session, person)).approval_status == "pending"


async def test_approve_needs_a_role(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    person = await pending_staff(session)

    assert (await decide(client, demo_users[Role.admin], person.id, "approve", {})).status_code == 422


@pytest.mark.parametrize("state", ["approved", "rejected"])
async def test_approve_refuses_an_account_that_is_not_pending(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession, state: str
) -> None:
    person = await pending_staff(session)
    person.approval_status = state
    session.add(person)
    await session.commit()

    response = await decide(client, demo_users[Role.admin], person.id, "approve", {"role": "editor"})

    assert response.status_code == 409
    assert response.json()["detail"] == "This account is not waiting for approval."
    assert (await reload(session, person)).approval_status == state


async def test_approve_refuses_an_unconfirmed_email(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    person = await pending_staff(session, email_confirmed=False)

    response = await decide(client, demo_users[Role.admin], person.id, "approve", {"role": "editor"})

    assert (response.status_code, response.json()["detail"]) == (409, "The email is not confirmed yet.")
    assert (await reload(session, person)).approval_status == "pending"


async def test_approve_refuses_an_unconfirmed_phone_until_the_admin_records_the_call(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    admin = demo_users[Role.admin]
    person = await pending_staff(session, phone_confirmed=False)

    refused = await decide(client, admin, person.id, "approve", {"role": "verifier"})
    assert refused.status_code == 409
    assert refused.json()["detail"] == (
        "Confirm the phone first: phone the person, then record 'phone confirmed by call'."
    )
    assert (await reload(session, person)).approval_status == "pending"

    called = await decide(client, admin, person.id, "confirm-phone-by-call")
    assert called.status_code == 200
    allowed = await decide(client, admin, person.id, "approve", {"role": "verifier"})

    assert allowed.status_code == 200
    assert (await reload(session, person)).approval_status == "approved"


async def test_approve_of_an_unknown_account_is_404(
    client: AsyncClient, demo_users: dict[Role, User]
) -> None:
    response = await decide(client, demo_users[Role.admin], 99999, "approve", {"role": "editor"})

    assert (response.status_code, response.json()["detail"]) == (404, "User not found")


async def test_approve_writes_the_audit_entries_and_emails_the_person(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession, mailbox: MailBox
) -> None:
    admin = demo_users[Role.admin]
    person = await pending_staff(session)

    await decide(client, admin, person.id, "approve", {"role": "editor"})

    [approval] = await entries(session, "user_approve")
    assert (approval.user_id, approval.listing_id) == (admin.id, None)
    assert approval.field_changed == "approval_status"
    assert (approval.old_value, approval.new_value) == ("pending", "approved")
    assert approval.reference == f"user:{person.id}"
    [role_entry] = await entries(session, "user_update")
    assert role_entry.field_changed == "role"
    assert (role_entry.old_value, role_entry.new_value) == ("verifier", "editor")
    assert role_entry.reference == f"user:{person.id}"
    [(to, subject, body)] = mailbox.sent
    assert to == person.email
    assert "approved" in subject.lower() or "approved" in body.lower()
    assert "log in" in body.lower()
    assert "password" not in body.lower()  # it never carries or asks for one
    text = " ".join(str(value) for entry in (approval, role_entry) for value in entry.model_dump().values())
    assert person.email not in text and "0456" not in text


async def test_approve_as_the_role_the_person_already_has_writes_no_role_entry(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession, mailbox: MailBox
) -> None:
    person = await pending_staff(session)  # a verifier

    await decide(client, demo_users[Role.admin], person.id, "approve", {"role": "verifier"})

    assert len(await entries(session, "user_approve")) == 1
    assert await entries(session, "user_update") == []


async def test_a_failing_email_does_not_fail_the_decision_and_is_logged_without_the_address(
    client: AsyncClient,
    demo_users: dict[Role, User],
    session: AsyncSession,
    mailbox: MailBox,
    caplog: pytest.LogCaptureFixture,
) -> None:
    mailbox.error = resend.EmailSendError("down")
    person = await pending_staff(session)
    caplog.set_level(logging.WARNING)

    response = await decide(client, demo_users[Role.admin], person.id, "approve", {"role": "editor"})

    assert response.status_code == 200
    assert (await reload(session, person)).approval_status == "approved"
    assert person.email not in caplog.text


# --- reject ---


@pytest.mark.parametrize("body", [{}, {"reason": "We could not check who you are."}, {"reason": None}])
async def test_reject_with_or_without_a_reason_and_the_person_can_never_log_in(
    client: AsyncClient,
    demo_users: dict[Role, User],
    session: AsyncSession,
    mailbox: MailBox,
    body: dict,
    demo_password_hash: str,
) -> None:
    person = await pending_staff(session)
    person.password_hash = demo_password_hash
    session.add(person)
    await session.commit()

    response = await decide(client, demo_users[Role.admin], person.id, "reject", body)

    assert response.status_code == 200, response.text
    assert response.json()["approval_status"] == "rejected"
    login = await start_login(client, person.email)
    assert (login.status_code, login.json()["detail"]) == (403, NOT_APPROVED)
    [(to, _subject, text)] = mailbox.sent
    assert to == person.email
    if body.get("reason"):
        assert body["reason"] in text


async def test_reject_writes_one_state_entry_and_one_reason_entry_when_a_reason_is_given(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession, mailbox: MailBox
) -> None:
    admin = demo_users[Role.admin]
    person = await pending_staff(session)

    await decide(client, admin, person.id, "reject", {"reason": "Not a verifier we know."})

    state, reason = await entries(session, "user_reject")
    assert state.field_changed == "approval_status"
    assert (state.old_value, state.new_value) == ("pending", "rejected")
    assert (reason.field_changed, reason.new_value) == ("reason", "Not a verifier we know.")
    assert {state.user_id, reason.user_id} == {admin.id}
    assert {state.reference, reason.reference} == {f"user:{person.id}"}


async def test_reject_without_a_reason_writes_only_the_state_entry(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession, mailbox: MailBox
) -> None:
    person = await pending_staff(session)

    await decide(client, demo_users[Role.admin], person.id, "reject", {})

    assert len(await entries(session, "user_reject")) == 1


async def test_reject_refuses_a_reason_over_500_characters(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    person = await pending_staff(session)

    response = await decide(client, demo_users[Role.admin], person.id, "reject", {"reason": "x" * 501})

    assert response.status_code == 422
    assert (await reload(session, person)).approval_status == "pending"


@pytest.mark.parametrize("state", ["approved", "rejected"])
async def test_reject_refuses_an_account_that_is_not_pending(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession, state: str
) -> None:
    person = await pending_staff(session)
    person.approval_status = state
    session.add(person)
    await session.commit()

    response = await decide(client, demo_users[Role.admin], person.id, "reject", {})

    assert response.status_code == 409
    assert response.json()["detail"] == "This account is not waiting for approval."


# --- suspend and reactivate ---


async def test_suspend_blocks_the_person_on_their_next_request_and_reactivate_gives_the_access_back(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession, mailbox: MailBox
) -> None:
    admin, editor = demo_users[Role.admin], demo_users[Role.editor]
    assert (await client.get("/auth/me", headers=bearer_for(editor))).status_code == 200

    suspended = await decide(client, admin, editor.id, "suspend", {"reason": "Left the team."})

    assert suspended.status_code == 200, suspended.text
    assert suspended.json()["is_active"] is False
    assert (await client.get("/auth/me", headers=bearer_for(editor))).status_code == 403

    back = await decide(client, admin, editor.id, "reactivate")

    assert back.status_code == 200
    assert back.json()["is_active"] is True
    assert (await client.get("/auth/me", headers=bearer_for(editor))).status_code == 200
    assert [to for to, _s, _b in mailbox.sent] == [editor.email, editor.email]


async def test_suspend_needs_a_reason(client: AsyncClient, demo_users: dict[Role, User]) -> None:
    editor = demo_users[Role.editor]

    for body in ({}, {"reason": ""}, {"reason": "   "}, {"reason": "x" * 501}):
        response = await decide(client, demo_users[Role.admin], editor.id, "suspend", body)
        assert response.status_code == 422, body


async def test_suspend_and_reactivate_write_their_audit_entries(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession, mailbox: MailBox
) -> None:
    admin, editor = demo_users[Role.admin], demo_users[Role.editor]

    await decide(client, admin, editor.id, "suspend", {"reason": "Left the team."})
    await decide(client, admin, editor.id, "reactivate")

    state, reason = await entries(session, "user_suspend")
    assert (state.field_changed, state.old_value, state.new_value) == ("is_active", "true", "false")
    assert (reason.field_changed, reason.new_value) == ("reason", "Left the team.")
    [reactivated] = await entries(session, "user_reactivate")
    assert reactivated.field_changed == "is_active"
    assert (reactivated.old_value, reactivated.new_value) == ("false", "true")
    assert {entry.reference for entry in (state, reason, reactivated)} == {f"user:{editor.id}"}
    assert {entry.user_id for entry in (state, reason, reactivated)} == {admin.id}


async def test_an_admin_cannot_suspend_themselves(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    admin = demo_users[Role.admin]

    response = await decide(client, admin, admin.id, "suspend", {"reason": "Oops."})

    assert response.status_code == 400
    assert response.json()["detail"] == "You cannot deactivate yourself or give up your own admin role."
    assert (await reload(session, admin)).is_active is True


async def test_the_last_active_admin_cannot_be_suspended_by_any_route(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession, demo_password_hash: str
) -> None:
    """With two admins one can suspend the other; the survivor is then the last active admin, and
    nobody can suspend it."""
    first = demo_users[Role.admin]
    second = await user_repository.create(
        session, name="Second Admin", email="second.admin@example.com", phone="+2348030000789",
        password_hash=demo_password_hash, role=Role.admin,
    )
    await session.commit()

    assert (await decide(client, first, second.id, "suspend", {"reason": "Left."})).status_code == 200
    # The suspended second admin is refused everywhere, so they cannot suspend the first, and the first
    # cannot suspend themselves.
    assert (await decide(client, second, first.id, "suspend", {"reason": "x"})).status_code == 403
    assert (await decide(client, first, first.id, "suspend", {"reason": "x"})).status_code == 400
    assert (await reload(session, first)).is_active is True


async def test_suspend_refuses_the_only_other_admin_when_the_caller_is_not_an_active_admin_row(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    """The service itself keeps one active admin even if the check of the caller were bypassed."""
    from app.services import account_decision_service

    admin = demo_users[Role.admin]

    with pytest.raises(account_decision_service.LastAdminError):
        await account_decision_service.suspend(
            session, caller_id=None, user_id=admin.id, reason="x", moment=utcnow()
        )


async def test_suspend_refuses_an_account_that_is_already_suspended(
    client: AsyncClient, demo_users: dict[Role, User]
) -> None:
    admin, editor = demo_users[Role.admin], demo_users[Role.editor]
    await decide(client, admin, editor.id, "suspend", {"reason": "Left."})

    response = await decide(client, admin, editor.id, "suspend", {"reason": "Again."})

    assert (response.status_code, response.json()["detail"]) == (409, "This account is already suspended.")


async def test_reactivate_refuses_an_account_that_is_not_suspended(
    client: AsyncClient, demo_users: dict[Role, User]
) -> None:
    response = await decide(client, demo_users[Role.admin], demo_users[Role.editor].id, "reactivate")

    assert (response.status_code, response.json()["detail"]) == (409, "This account is not suspended.")


async def test_reactivate_never_brings_back_a_rejected_or_a_closed_account(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    admin = demo_users[Role.admin]
    rejected = await pending_staff(session, "rejected@example.com")
    rejected.approval_status, rejected.is_active = "rejected", False
    closed = await pending_staff(session, "closed@example.com")
    closed.approval_status, closed.is_active, closed.closed_at = "approved", False, utcnow()
    session.add_all([rejected, closed])
    await session.commit()

    for person in (rejected, closed):
        response = await decide(client, admin, person.id, "reactivate")
        assert response.status_code == 409, person.email
        assert response.json()["detail"] == "This account is not suspended."
        assert (await reload(session, person)).is_active is False


async def test_suspend_refuses_a_closed_account(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    closed = await pending_staff(session, "closed@example.com")
    closed.approval_status, closed.closed_at = "approved", utcnow()
    session.add(closed)
    await session.commit()

    response = await decide(client, demo_users[Role.admin], closed.id, "suspend", {"reason": "x"})

    assert response.status_code == 409


async def test_a_suspended_provider_is_refused_on_the_next_request_too(
    client: AsyncClient, demo_users: dict[Role, User]
) -> None:
    provider = demo_users[Role.provider]

    await decide(client, demo_users[Role.admin], provider.id, "suspend", {"reason": "Left."})

    assert (await client.get("/auth/me", headers=bearer_for(provider))).status_code == 403


# --- what no decision ever does ---


async def test_there_is_no_route_that_deletes_an_account() -> None:
    from app.main import app

    delete_routes = [
        path
        for path, operations in app.openapi()["paths"].items()
        if "/users" in path and "delete" in operations
    ]

    assert delete_routes == []


async def test_nothing_is_ever_deleted_by_a_decision(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession, mailbox: MailBox
) -> None:
    admin = demo_users[Role.admin]
    person = await pending_staff(session)
    count = len((await session.exec(select(User))).all())

    await decide(client, admin, person.id, "reject", {})
    await decide(client, admin, demo_users[Role.editor].id, "suspend", {"reason": "x"})
    await decide(client, admin, demo_users[Role.editor].id, "reactivate")

    assert len((await session.exec(select(User))).all()) == count


async def test_the_decision_routes_are_in_the_list_of_routes_that_need_a_login() -> None:
    from tests.integration.test_account_state import routes_that_need_a_login

    found = routes_that_need_a_login()

    for action in ("approve", "reject", "suspend", "reactivate"):
        assert ("POST", f"/admin/users/1/{action}") in found
    assert ("GET", "/admin/activity") in found


async def test_the_emails_and_the_audit_entries_hold_no_password_phone_or_code(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession, mailbox: MailBox
) -> None:
    admin = demo_users[Role.admin]
    person = await pending_staff(session)

    await decide(client, admin, person.id, "approve", {"role": "editor"})
    await decide(client, admin, person.id, "suspend", {"reason": "Left the team."})
    await decide(client, admin, person.id, "reactivate")

    everything = " ".join(body for _to, _subject, body in mailbox.sent)
    for entry in (await session.exec(select(AuditEntry))).all():
        everything += " ".join(str(value) for value in entry.model_dump().values())
    assert "0456" not in everything and "+234803" not in everything
    assert "http" not in everything.lower()  # no link
