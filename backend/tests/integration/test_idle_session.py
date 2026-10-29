"""Automatic sign-out after inactivity, on the server. Requirements: NFR-06 (sessions), FR-30. Spec:
specs/2026-10-29-idle-sign-out/.

The login token lives only as long as the idle limit of the account's role (admin 5 minutes,
any other account 15 minutes, both settings). The browser asks `POST /auth/keep-alive` for a
fresh token while the person is active, so a token that is not renewed simply expires: the
server refuses a session that has been idle longer than the limit. A whole session also ends
after `jwt_minutes` (12 hours), however active the person is. Every user here is fictional.
"""
import re
from datetime import datetime, timedelta, timezone

import pytest

from app.core.config import settings
from app.core.security import create_access_token, decode_access_claims
from app.models.base import Role
from app.services import auth_service
from tests.conftest import DEMO_PASSWORD

pytestmark = pytest.mark.anyio


class SmsRecorder:
    def __init__(self) -> None:
        self.messages: list[tuple[str, str]] = []

    async def send_sms(self, phone: str, message: str) -> None:
        self.messages.append((phone, message))

    @property
    def last_code(self) -> str:
        return re.search(r"\b(\d{6})\b", self.messages[-1][1]).group(1)


@pytest.fixture
def sms(monkeypatch) -> SmsRecorder:
    recorder = SmsRecorder()
    monkeypatch.setattr(auth_service, "send_sms", recorder.send_sms)
    return recorder


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def milliseconds_ago(**duration) -> int:
    return int((datetime.now(timezone.utc) - timedelta(**duration)).timestamp() * 1000)


async def log_in(client, sms: SmsRecorder, user):
    started = await client.post("/auth/login", json={"email": user.email, "password": DEMO_PASSWORD})
    return await client.post(
        "/auth/verify-code",
        json={"challenge_token": started.json()["challenge_token"], "code": sms.last_code},
    )


# --- the limit per role, from settings ---

@pytest.mark.parametrize(
    ("role", "seconds"),
    [(Role.admin, 5 * 60), (Role.editor, 15 * 60), (Role.verifier, 15 * 60), (Role.provider, 15 * 60)],
)
async def test_login_gives_a_token_that_lives_as_long_as_the_idle_limit_of_the_role(
    client, demo_users, sms, role, seconds
):
    response = await log_in(client, sms, demo_users[role])

    assert response.status_code == 200
    body = response.json()
    assert body["expires_in"] == seconds
    lifetime = decode_access_claims(body["access_token"]).expires_at - datetime.now(timezone.utc)
    assert timedelta(seconds=seconds - 5) < lifetime <= timedelta(seconds=seconds)


async def test_both_limits_are_settings(client, demo_users, sms, monkeypatch):
    monkeypatch.setattr(settings, "idle_minutes_admin", 7)
    monkeypatch.setattr(settings, "idle_minutes_other", 20)

    assert (await log_in(client, sms, demo_users[Role.admin])).json()["expires_in"] == 7 * 60
    assert (await log_in(client, sms, demo_users[Role.editor])).json()["expires_in"] == 20 * 60


# --- the server refuses an idle session ---

async def test_a_token_that_was_not_renewed_within_the_limit_is_refused(client, demo_users, monkeypatch):
    admin = demo_users[Role.admin]
    token = create_access_token(admin.id, admin.role)
    assert (await client.get("/auth/me", headers=bearer(token))).status_code == 200

    monkeypatch.setattr(settings, "idle_minutes_admin", -1)  # the limit has passed since it was made
    idle_token = create_access_token(admin.id, admin.role)

    response = await client.get("/auth/me", headers=bearer(idle_token))
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or expired token"


async def test_an_idle_editor_is_refused_after_the_other_limit_too(client, demo_users, monkeypatch):
    editor = demo_users[Role.editor]
    monkeypatch.setattr(settings, "idle_minutes_other", -1)

    response = await client.get("/auth/me", headers=bearer(create_access_token(editor.id, editor.role)))

    assert response.status_code == 401


# --- POST /auth/keep-alive ---

async def test_keep_alive_gives_a_fresh_token_and_the_limit_of_the_role(client, demo_users):
    admin = demo_users[Role.admin]
    old_token = create_access_token(admin.id, admin.role)

    response = await client.post("/auth/keep-alive", headers=bearer(old_token))

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["expires_in"] == settings.idle_minutes_admin * 60
    assert "user" not in body  # only a new token
    assert (await client.get("/auth/me", headers=bearer(body["access_token"]))).json()["role"] == "admin"


async def test_keep_alive_uses_the_role_in_the_database_not_the_old_token(client, demo_users, session):
    editor = demo_users[Role.editor]
    token = create_access_token(editor.id, editor.role)
    editor.role = Role.admin  # promoted since the token was made
    await session.commit()

    body = (await client.post("/auth/keep-alive", headers=bearer(token))).json()

    assert body["expires_in"] == settings.idle_minutes_admin * 60


async def test_keep_alive_does_not_restart_the_clock_of_the_whole_session(client, demo_users):
    admin = demo_users[Role.admin]
    token = create_access_token(admin.id, admin.role, session_started_ms=milliseconds_ago(hours=3))

    renewed = (await client.post("/auth/keep-alive", headers=bearer(token))).json()["access_token"]

    started = decode_access_claims(renewed).session_started_ms
    assert abs(started - milliseconds_ago(hours=3)) < 5_000


async def test_a_session_older_than_the_longest_session_is_refused_however_active(client, demo_users):
    admin = demo_users[Role.admin]
    too_old = milliseconds_ago(minutes=settings.jwt_minutes + 1)
    token = create_access_token(admin.id, admin.role, session_started_ms=too_old)  # its own expiry is fresh

    assert (await client.get("/auth/me", headers=bearer(token))).status_code == 401
    assert (await client.post("/auth/keep-alive", headers=bearer(token))).status_code == 401


@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer garbage"}])
async def test_keep_alive_without_a_good_token_is_401(client, demo_users, headers):
    assert (await client.post("/auth/keep-alive", headers=headers)).status_code == 401


async def test_keep_alive_for_a_deactivated_account_is_403(client, demo_users, session):
    editor = demo_users[Role.editor]
    token = create_access_token(editor.id, editor.role)
    editor.is_active = False
    await session.commit()

    assert (await client.post("/auth/keep-alive", headers=bearer(token))).status_code == 403


async def test_keep_alive_cannot_revive_a_token_made_before_a_password_change(client, demo_users, session):
    editor = demo_users[Role.editor]
    token = create_access_token(editor.id, editor.role)
    editor.password_changed_at = datetime.now(timezone.utc) + timedelta(seconds=5)
    await session.commit()

    assert (await client.post("/auth/keep-alive", headers=bearer(token))).status_code == 401
