"""Setting up, using up and switching off the authenticator app. Requirements: FR-58, NFR-06.
Spec: specs/2026-10-23-accounts-and-facility-ownership/ (Phase 2c).

The set-up needs the password again, shows the secret once (as text and as the `otpauth://` address a QR
code holds), and switches the app on only when the first code from the app is right; that is also when the
ten backup codes are made and shown, once. The secret is stored encrypted, and is never in a log, an audit
entry or an answer after the set-up.
"""

import json
import logging
import re
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core import secret_box, totp
from app.core.config import settings
from app.models import AuditEntry, User
from app.models.base import Role
from tests.conftest import DEMO_PASSWORD
from tests.staff_helpers import bearer_for

pytestmark = pytest.mark.anyio

BASE = "/account/two-factor"
WRONG_PASSWORD = "The password is not right."
WRONG_CODE = "That code is not right. Check that your phone's time is set automatically."


def current_code(secret: str) -> str:
    return totp.code_for(secret, totp.step_at(datetime.now(timezone.utc)))


async def start(client: AsyncClient, user: User, password: str = DEMO_PASSWORD):
    return await client.post(f"{BASE}/start", json={"password": password}, headers=bearer_for(user))


async def confirm(client: AsyncClient, user: User, code: str):
    return await client.post(f"{BASE}/confirm", json={"code": code}, headers=bearer_for(user))


async def switch_on(client: AsyncClient, user: User) -> tuple[str, list[str]]:
    """Runs the whole set-up through the API; returns the secret and the backup codes."""
    secret = (await start(client, user)).json()["secret"]
    response = await confirm(client, user, current_code(secret))
    assert response.status_code == 200, response.text
    return secret, response.json()["backup_codes"]


async def audit_text(session: AsyncSession) -> str:
    rows = (await session.exec(select(AuditEntry))).all()
    return " ".join(str(value) for row in rows for value in row.model_dump().values())


async def test_the_status_of_an_account_with_no_app(
    client: AsyncClient, demo_users: dict[Role, User]
) -> None:
    response = await client.get(BASE, headers=bearer_for(demo_users[Role.editor]))

    assert response.status_code == 200
    assert response.json() == {"enabled": False, "backup_codes_left": 0, "available": True}


async def test_every_two_factor_route_needs_a_login(client: AsyncClient) -> None:
    routes = [("GET", ""), ("POST", "/start"), ("POST", "/confirm"), ("POST", "/disable")]
    routes.append(("POST", "/backup-codes"))
    for method, path in routes:
        response = await client.request(method, BASE + path, json={} if method == "POST" else None)
        assert response.status_code == 401, path


@pytest.mark.parametrize("role", [Role.verifier, Role.editor, Role.admin, Role.provider])
async def test_every_role_can_set_it_up(
    client: AsyncClient, demo_users: dict[Role, User], role: Role
) -> None:
    secret, codes = await switch_on(client, demo_users[role])

    assert len(secret) == 32 and len(codes) == 10


async def test_start_needs_the_password_and_gives_the_secret_and_the_address_for_a_qr_code(
    client: AsyncClient, demo_users: dict[Role, User]
) -> None:
    editor = demo_users[Role.editor]

    wrong = await start(client, editor, "not-the-password")
    right = await start(client, editor)

    assert wrong.status_code == 403 and wrong.json()["detail"] == WRONG_PASSWORD
    assert right.status_code == 200
    body = right.json()
    assert re.fullmatch(r"[A-Z2-7]{32}", body["secret"])
    assert body["otpauth_uri"] == totp.otpauth_uri(body["secret"], editor.email)


async def test_the_secret_is_stored_encrypted_and_the_app_is_not_on_until_the_first_code_is_right(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    editor = demo_users[Role.editor]

    secret = (await start(client, editor)).json()["secret"]

    await session.refresh(editor)
    assert editor.totp_secret is not None and secret not in editor.totp_secret
    assert secret_box.decrypt(editor.totp_secret) == secret
    assert editor.totp_enabled_at is None and editor.two_factor_enabled is False
    assert (await client.get(BASE, headers=bearer_for(editor))).json()["enabled"] is False


async def test_a_wrong_first_code_does_not_switch_it_on_and_a_right_one_does_and_gives_ten_backup_codes_once(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    editor = demo_users[Role.editor]
    secret = (await start(client, editor)).json()["secret"]

    wrong = await confirm(client, editor, "000000" if current_code(secret) != "000000" else "111111")
    assert wrong.status_code == 400 and wrong.json()["detail"] == WRONG_CODE
    await session.refresh(editor)
    assert editor.totp_enabled_at is None

    right = await confirm(client, editor, current_code(secret))
    assert right.status_code == 200
    codes = right.json()["backup_codes"]
    assert len(codes) == 10 and len(set(codes)) == 10
    await session.refresh(editor)
    assert editor.two_factor_enabled is True
    assert editor.totp_last_step is not None  # the step of the first code: it cannot be used again
    assert len(totp.load_hashes(editor.backup_code_hashes)) == 10
    assert all(code not in (editor.backup_code_hashes or "") for code in codes)
    assert (await client.get(BASE, headers=bearer_for(editor))).json() == {
        "enabled": True,
        "backup_codes_left": 10,
        "available": True,
    }


async def test_a_code_with_a_space_as_the_app_shows_it_is_accepted_when_confirming(
    client: AsyncClient, demo_users: dict[Role, User]
) -> None:
    editor = demo_users[Role.editor]
    secret = (await start(client, editor)).json()["secret"]
    code = current_code(secret)

    assert (await confirm(client, editor, f"{code[:3]} {code[3:]}")).status_code == 200


async def test_confirming_with_nothing_started_is_400(
    client: AsyncClient, demo_users: dict[Role, User]
) -> None:
    response = await confirm(client, demo_users[Role.editor], "123456")

    assert response.status_code == 400
    assert response.json()["detail"] == "Start the set-up first."


async def test_starting_again_before_the_first_code_replaces_the_unfinished_secret(
    client: AsyncClient, demo_users: dict[Role, User]
) -> None:
    editor = demo_users[Role.editor]
    first = (await start(client, editor)).json()["secret"]
    second = (await start(client, editor)).json()["secret"]

    assert first != second
    assert (await confirm(client, editor, current_code(first))).status_code == 400
    assert (await confirm(client, editor, current_code(second))).status_code == 200


async def test_starting_when_it_is_already_on_is_409(
    client: AsyncClient, demo_users: dict[Role, User]
) -> None:
    editor = demo_users[Role.editor]
    await switch_on(client, editor)

    response = await start(client, editor)

    assert response.status_code == 409
    assert response.json()["detail"] == "The authenticator app is already switched on."


async def test_with_no_usable_key_the_set_up_is_503_nothing_is_stored_and_the_status_says_so(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "totp_encryption_key", "")
    editor = demo_users[Role.editor]

    response = await start(client, editor)
    status = await client.get(BASE, headers=bearer_for(editor))

    assert response.status_code == 503
    assert response.json()["detail"] == "The authenticator app is not available yet."
    assert status.json()["available"] is False
    await session.refresh(editor)
    assert editor.totp_secret is None


async def test_the_audit_log_says_it_was_switched_on_and_never_holds_a_secret_or_a_code(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    editor = demo_users[Role.editor]
    secret, codes = await switch_on(client, editor)

    rows = (await session.exec(select(AuditEntry).where(AuditEntry.action == "two_factor_on"))).all()
    assert len(rows) == 1
    assert (rows[0].user_id, rows[0].field_changed, rows[0].new_value) == (editor.id, "two_factor", "on")
    text = await audit_text(session)
    assert secret not in text
    assert current_code(secret) not in text
    assert all(code not in text for code in codes)


async def test_the_secret_is_in_no_answer_but_the_start_and_in_no_log(
    client: AsyncClient, demo_users: dict[Role, User], caplog: pytest.LogCaptureFixture
) -> None:
    editor, admin = demo_users[Role.editor], demo_users[Role.admin]
    with caplog.at_level(logging.DEBUG):
        secret, codes = await switch_on(client, editor)
        answers = [
            await client.get(BASE, headers=bearer_for(editor)),
            await client.get("/auth/me", headers=bearer_for(editor)),
            await client.get("/admin/users", headers=bearer_for(admin)),
        ]

    for answer in answers:
        assert secret not in answer.text
        assert "totp_secret" not in answer.text and "backup_code_hashes" not in answer.text
    assert secret not in caplog.text
    assert all(code not in caplog.text for code in codes)


async def test_ten_wrong_codes_in_an_hour_lock_the_set_up_and_the_right_code_is_then_refused_too(
    client: AsyncClient, demo_users: dict[Role, User]
) -> None:
    editor = demo_users[Role.editor]
    secret = (await start(client, editor)).json()["secret"]
    wrong = "000000" if current_code(secret) != "000000" else "111111"
    for _ in range(10):
        assert (await confirm(client, editor, wrong)).status_code == 400

    locked = await confirm(client, editor, current_code(secret))

    assert locked.status_code == 429
    assert locked.json()["detail"].startswith("Too many wrong codes. Try again in ")


async def test_the_set_up_start_is_rate_limited_per_address_like_the_login(
    client: AsyncClient, demo_users: dict[Role, User]
) -> None:
    editor = demo_users[Role.editor]
    for _ in range(10):
        await start(client, editor, "not-the-password")

    assert (await start(client, editor)).status_code == 429


# --- switching it off and new backup codes ---


async def disable(client: AsyncClient, user: User, code: str, password: str = DEMO_PASSWORD):
    body = {"password": password, "code": code}
    return await client.post(f"{BASE}/disable", json=body, headers=bearer_for(user))


async def test_switching_off_needs_the_password_and_a_right_code_and_clears_everything(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    editor = demo_users[Role.editor]
    secret, _codes = await switch_on(client, editor)
    wrong = "000000" if current_code(secret) != "000000" else "111111"

    assert (await disable(client, editor, current_code(secret), "not-the-password")).status_code == 403
    assert (await disable(client, editor, wrong)).status_code == 400
    await session.refresh(editor)
    assert editor.two_factor_enabled is True

    # The set-up code is of the same 30 seconds, so the next step is used (a code works once).
    next_code = totp.code_for(secret, totp.step_at(datetime.now(timezone.utc)) + 1)
    response = await disable(client, editor, next_code)

    assert response.status_code == 200 and response.json() == {"enabled": False}
    await session.refresh(editor)
    kept = (editor.totp_secret, editor.totp_enabled_at, editor.totp_last_step, editor.backup_code_hashes)
    assert kept == (None, None, None, None)
    rows = (await session.exec(select(AuditEntry).where(AuditEntry.action == "two_factor_off"))).all()
    assert [(row.user_id, row.new_value) for row in rows] == [(editor.id, "off")]


async def test_a_backup_code_can_switch_it_off_when_the_phone_is_lost(
    client: AsyncClient, demo_users: dict[Role, User]
) -> None:
    editor = demo_users[Role.editor]
    _secret, codes = await switch_on(client, editor)

    response = await disable(client, editor, codes[0])

    assert response.status_code == 200


async def test_new_backup_codes_need_the_password_and_a_code_and_the_old_ones_stop_working(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    editor = demo_users[Role.editor]
    _secret, old_codes = await switch_on(client, editor)
    body = {"password": DEMO_PASSWORD, "code": old_codes[0]}

    async def ask(**changes: str):
        return await client.post(f"{BASE}/backup-codes", json={**body, **changes}, headers=bearer_for(editor))

    assert (await ask(password="no")).status_code == 403
    assert (await ask(code="WRONGWRONG")).status_code == 400
    response = await ask()

    assert response.status_code == 200
    new_codes = response.json()["backup_codes"]
    assert len(new_codes) == 10 and not set(new_codes) & set(old_codes)
    await session.refresh(editor)
    assert totp.use_backup_code(editor.backup_code_hashes, old_codes[1]) is None  # an old code is dead
    assert totp.use_backup_code(editor.backup_code_hashes, new_codes[0]) is not None
    assert (await session.exec(select(AuditEntry).where(AuditEntry.action == "two_factor_codes"))).all()


async def test_switching_off_or_new_codes_when_it_is_not_on_is_400(
    client: AsyncClient, demo_users: dict[Role, User]
) -> None:
    editor = demo_users[Role.editor]

    off = await disable(client, editor, "123456")
    body = {"password": DEMO_PASSWORD, "code": "123456"}
    codes = await client.post(f"{BASE}/backup-codes", json=body, headers=bearer_for(editor))

    assert off.status_code == 400 and codes.status_code == 400
    assert off.json()["detail"] == "The authenticator app is not switched on."


async def test_the_auth_answers_say_whether_the_app_is_on(
    client: AsyncClient, demo_users: dict[Role, User]
) -> None:
    editor = demo_users[Role.editor]
    assert (await client.get("/auth/me", headers=bearer_for(editor))).json()["two_factor_enabled"] is False

    await switch_on(client, editor)

    assert (await client.get("/auth/me", headers=bearer_for(editor))).json()["two_factor_enabled"] is True
    listed = (await client.get("/admin/users", headers=bearer_for(demo_users[Role.admin]))).json()["items"]
    assert {user["email"]: user["two_factor_enabled"] for user in listed}[editor.email] is True
    assert json.dumps(listed).count("two_factor_enabled") == 4
