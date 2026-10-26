"""An account that is not ready has no access anywhere. Requirements: FR-48, FR-49, NFR-06.
Spec: specs/2026-10-23-accounts-and-facility-ownership/ (Phase 2).

"Not ready" means: waiting for approval, rejected, email or phone not confirmed, closed, or deactivated. The
one dependency that loads the user (`get_current_user`) refuses all of them, so no endpoint can forget it;
this file calls EVERY route that needs a login, found from the app's own OpenAPI document, with an admin
account in each state. Login refuses them too, but only after the password is right. An account made the
old way (the admin, the seed, the first-admin command) is approved and confirmed from the start.
"""

import re
from datetime import datetime, timezone

import pytest
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.main import app
from app.models import User
from app.models.base import Role
from app.repositories import user_repository
from app.services import auth_service
from tests.integration.test_auth import SmsRecorder, start_login, verify
from tests.staff_helpers import bearer_for

pytestmark = pytest.mark.anyio

WAITING = "This account is waiting for approval by an admin."
STATES = {
    "pending": WAITING,
    "rejected": "This account was not approved.",
    "email_unconfirmed": "Confirm your email address first.",
    "phone_unconfirmed": "Confirm your phone number first.",
    "closed": "This account is closed.",
    "deactivated": "This account is deactivated.",
}


@pytest.fixture(autouse=True)
def termii_is_live(monkeypatch: pytest.MonkeyPatch) -> None:
    """The phone must be confirmed only when Termii is live (decision D20), so this file runs with it live.
    Every test that could send an SMS also uses the `sms` fixture below, which replaces the sending."""
    monkeypatch.setattr(settings, "termii_api_key", "key-set-for-tests")


@pytest.fixture
def sms(monkeypatch: pytest.MonkeyPatch) -> SmsRecorder:
    recorder = SmsRecorder()
    monkeypatch.setattr(auth_service, "send_sms", recorder.send_sms)
    return recorder


async def put_in_state(session: AsyncSession, user: User, state: str) -> None:
    if state == "pending":
        user.approval_status = "pending"
    elif state == "rejected":
        user.approval_status = "rejected"
    elif state == "email_unconfirmed":
        user.email_verified_at = None
    elif state == "phone_unconfirmed":
        user.phone_verified_at = None
    elif state == "closed":
        user.closed_at = datetime.now(timezone.utc)
        user.is_active = False
    elif state == "deactivated":
        user.is_active = False
    session.add(user)
    await session.commit()


def routes_that_need_a_login() -> list[tuple[str, str]]:
    """(method, path) of every operation that needs a login, read from the app's OpenAPI document.

    `get_current_user` depends on the OAuth2 bearer scheme, and FastAPI lists that scheme as `security` on
    every operation that uses it (directly or through `require_role`), so a new route is found without
    anyone adding it to a list. A path parameter is replaced by 1.
    """
    found = []
    for path, operations in app.openapi()["paths"].items():
        for method, operation in operations.items():
            if "security" in operation:
                found.append((method.upper(), re.sub(r"\{[^}]+\}", "1", path)))
    return found


def body_for(method: str) -> dict | None:
    return None if method == "GET" else {}


def test_the_list_of_routes_that_need_a_login_is_found_and_is_not_small() -> None:
    found = routes_that_need_a_login()

    assert len(found) >= 20
    for expected in [("GET", "/auth/me"), ("GET", "/listings"), ("GET", "/admin/users")]:
        assert expected in found
    assert ("GET", "/provider/listing") in found
    assert ("POST", "/auth/login") not in found  # the login itself needs no login


@pytest.mark.parametrize("state", list(STATES))
async def test_every_route_that_needs_a_login_refuses_an_admin_who_is_not_ready(
    client, demo_users: dict[Role, User], session: AsyncSession, state: str
) -> None:
    admin = demo_users[Role.admin]
    await put_in_state(session, admin, state)
    wrong: list[str] = []

    for method, path in routes_that_need_a_login():
        response = await client.request(method, path, headers=bearer_for(admin), json=body_for(method))
        if response.status_code != 403 or response.json().get("detail") != STATES[state]:
            wrong.append(f"{method} {path}: {response.status_code} {response.text[:80]}")

    assert wrong == []


async def test_the_same_routes_do_not_refuse_a_ready_admin_with_a_login_error(
    client, demo_users: dict[Role, User]
) -> None:
    admin = demo_users[Role.admin]
    not_ready_messages = set(STATES.values())
    refused_as_not_ready = []

    for method, path in routes_that_need_a_login():
        response = await client.request(method, path, headers=bearer_for(admin), json=body_for(method))
        is_json = response.headers.get("content-type", "").startswith("application/json")
        detail = response.json().get("detail") if is_json else None
        if response.status_code == 401 or (isinstance(detail, str) and detail in not_ready_messages):
            refused_as_not_ready.append(f"{method} {path}")

    assert refused_as_not_ready == []


async def test_a_request_with_no_token_is_still_401_everywhere(client) -> None:
    for method, path in routes_that_need_a_login():
        response = await client.request(method, path, json=body_for(method))
        assert response.status_code == 401, f"{method} {path}"


@pytest.mark.parametrize("state", list(STATES))
async def test_login_refuses_an_account_that_is_not_ready_after_the_password_and_sends_no_sms(
    client, demo_users: dict[Role, User], session: AsyncSession, sms: SmsRecorder, state: str
) -> None:
    editor = demo_users[Role.editor]
    await put_in_state(session, editor, state)

    response = await start_login(client, editor.email)

    assert response.status_code == 403
    assert response.json()["detail"] == STATES[state]
    assert sms.messages == []


@pytest.mark.parametrize("state", list(STATES))
async def test_login_does_not_reveal_the_state_of_an_account_to_a_wrong_password(
    client, demo_users: dict[Role, User], session: AsyncSession, sms: SmsRecorder, state: str
) -> None:
    editor = demo_users[Role.editor]
    await put_in_state(session, editor, state)

    response = await start_login(client, editor.email, "not-the-password")

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


async def test_an_account_that_becomes_pending_between_the_two_steps_is_refused_at_the_second(
    client, demo_users: dict[Role, User], session: AsyncSession, sms: SmsRecorder
) -> None:
    editor = demo_users[Role.editor]
    challenge_token = (await start_login(client, editor.email)).json()["challenge_token"]
    await put_in_state(session, editor, "pending")

    response = await verify(client, challenge_token, sms.last_code)

    assert response.status_code == 403
    assert response.json()["detail"] == WAITING


async def test_a_token_made_before_the_account_was_closed_stops_working_at_once(
    client, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    editor = demo_users[Role.editor]
    headers = bearer_for(editor)
    assert (await client.get("/auth/me", headers=headers)).status_code == 200

    await put_in_state(session, editor, "closed")

    assert (await client.get("/auth/me", headers=headers)).status_code == 403


async def test_an_account_made_the_old_way_is_approved_and_confirmed_and_works(
    client, demo_users: dict[Role, User]
) -> None:
    for user in demo_users.values():
        assert user.approval_status == "approved"
        assert user.email_verified_at is not None and user.phone_verified_at is not None
        assert user.closed_at is None and user.password_changed_at is None and user.signup_note is None
        assert (await client.get("/auth/me", headers=bearer_for(user))).status_code == 200


async def test_an_account_can_be_made_unconfirmed_for_sign_up_later(session: AsyncSession) -> None:
    user = await user_repository.create(
        session,
        name="New Person",
        email="new.person@example.test",
        phone="+2340000000099",
        password_hash="x",
        role=Role.provider,
        confirmed=False,
        approval_status="pending",
    )

    assert (user.email_verified_at, user.phone_verified_at, user.approval_status) == (None, None, "pending")
