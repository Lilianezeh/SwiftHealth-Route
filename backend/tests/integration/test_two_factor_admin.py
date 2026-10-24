"""Losing the phone: another admin resets the app, or the one-time start-up step does.
Requirements: FR-58, FR-55, NFR-06, NFR-07.
Spec: specs/2026-10-23-accounts-and-facility-ownership/ (Phase 2c).

`POST /admin/users/{id}/reset-two-factor` (admin only, never on yourself) clears the app and the backup
codes of another account and writes an audit entry. For the only admin, who cannot ask another admin, the
start-up step reads the variable RESET_TWO_FACTOR_FOR_EMAIL once (set in Render, deleted after one start).
Every name, address and number is fictional.
"""

import logging
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core import secret_box, totp
from app.models import AuditEntry, User
from app.models.base import Role
from app.reset_two_factor import run_at_startup
from tests.conftest import DEMO_PASSWORD, TEST_DATABASE_URL
from tests.staff_helpers import bearer_for

pytestmark = pytest.mark.anyio

LOGGER = "app.reset_two_factor"


async def app_on(session: AsyncSession, user: User) -> None:
    user.totp_secret = secret_box.encrypt(totp.new_secret())
    user.totp_enabled_at = datetime.now(timezone.utc)
    user.totp_last_step = 12345
    user.backup_code_hashes = totp.hash_backup_codes(totp.new_backup_codes())
    session.add(user)
    await session.commit()


def nothing_left(user: User) -> bool:
    columns = (user.totp_secret, user.totp_enabled_at, user.totp_last_step, user.backup_code_hashes)
    return columns == (None,) * 4


async def reset(client: AsyncClient, caller: User | None, target_id: int):
    headers = bearer_for(caller) if caller else {}
    return await client.post(f"/admin/users/{target_id}/reset-two-factor", headers=headers)


async def test_an_admin_clears_another_accounts_app_and_it_is_in_the_audit_log(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    admin, editor = demo_users[Role.admin], demo_users[Role.editor]
    await app_on(session, editor)

    response = await reset(client, admin, editor.id)

    assert response.status_code == 200 and response.json() == {"enabled": False}
    await session.refresh(editor)
    assert nothing_left(editor)
    [entry] = (await session.exec(select(AuditEntry).where(AuditEntry.action == "two_factor_reset"))).all()
    assert (entry.user_id, entry.field_changed) == (admin.id, "two_factor")
    assert entry.new_value == f"reset for user {editor.id}"


async def test_the_person_logs_in_with_a_code_by_message_again_after_the_reset(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    admin, editor = demo_users[Role.admin], demo_users[Role.editor]
    await app_on(session, editor)
    await reset(client, admin, editor.id)

    login = {"email": editor.email, "password": DEMO_PASSWORD}
    response = await client.post("/auth/login", json=login)

    assert response.json()["method"] == "sms"


async def test_an_admin_cannot_reset_their_own_and_nobody_else_can_reset_anyone(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    admin, editor = demo_users[Role.admin], demo_users[Role.editor]
    await app_on(session, admin)
    await app_on(session, editor)

    own = await reset(client, admin, admin.id)
    assert own.status_code == 400
    assert own.json()["detail"] == "Another admin must reset your two-step login."
    for role in (Role.editor, Role.verifier, Role.provider):
        assert (await reset(client, demo_users[role], editor.id)).status_code == 403
    assert (await reset(client, None, editor.id)).status_code == 401
    assert (await reset(client, admin, 9999)).status_code == 404
    await session.refresh(admin)
    await session.refresh(editor)
    assert admin.two_factor_enabled and editor.two_factor_enabled


# --- the start-up step for the only admin ---


@pytest.fixture
async def factory(session: AsyncSession):
    engine = create_async_engine(TEST_DATABASE_URL)
    yield async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    await engine.dispose()


def messages(caplog: pytest.LogCaptureFixture) -> list[str]:
    return [record.getMessage() for record in caplog.records if record.name == LOGGER]


async def test_with_the_variable_it_clears_that_account_and_logs_only_a_fixed_sentence(
    session: AsyncSession, factory, demo_users: dict[Role, User], caplog: pytest.LogCaptureFixture
) -> None:
    admin = demo_users[Role.admin]
    await app_on(session, admin)
    other = demo_users[Role.editor]
    await app_on(session, other)

    with caplog.at_level(logging.INFO):
        await run_at_startup({"RESET_TWO_FACTOR_FOR_EMAIL": f"  {admin.email.upper()} "}, factory)

    await session.refresh(admin)
    await session.refresh(other)
    assert nothing_left(admin) and other.two_factor_enabled  # only the named account
    assert messages(caplog) == ["two-factor reset for an account"]
    assert admin.email not in caplog.text and admin.email.upper() not in caplog.text
    [entry] = (await session.exec(select(AuditEntry).where(AuditEntry.action == "two_factor_reset"))).all()
    assert (entry.user_id, entry.reference) == (admin.id, "startup-reset")


async def test_without_the_variable_or_with_a_blank_one_it_does_nothing_and_says_nothing(
    session: AsyncSession, factory, demo_users: dict[Role, User], caplog: pytest.LogCaptureFixture
) -> None:
    admin = demo_users[Role.admin]
    await app_on(session, admin)

    with caplog.at_level(logging.INFO):
        await run_at_startup({}, factory)
        await run_at_startup({"RESET_TWO_FACTOR_FOR_EMAIL": "   "}, factory)

    await session.refresh(admin)
    assert admin.two_factor_enabled
    assert messages(caplog) == []
    assert (await session.exec(select(AuditEntry).where(AuditEntry.action == "two_factor_reset"))).all() == []


async def test_an_email_that_matches_nobody_changes_nothing_and_never_shows_the_address(
    session: AsyncSession, factory, demo_users: dict[Role, User], caplog: pytest.LogCaptureFixture
) -> None:
    admin = demo_users[Role.admin]
    await app_on(session, admin)

    with caplog.at_level(logging.INFO):
        await run_at_startup({"RESET_TWO_FACTOR_FOR_EMAIL": "nobody@example.test"}, factory)

    await session.refresh(admin)
    assert admin.two_factor_enabled
    assert messages(caplog) == ["two-factor reset: no account has the email in RESET_TWO_FACTOR_FOR_EMAIL"]
    assert "nobody@example.test" not in caplog.text


async def test_a_failure_is_logged_without_details_and_never_raised(
    caplog: pytest.LogCaptureFixture,
) -> None:
    def broken_factory():
        raise RuntimeError("password=secret host=db")

    with caplog.at_level(logging.INFO):
        await run_at_startup({"RESET_TWO_FACTOR_FOR_EMAIL": "x@example.test"}, broken_factory)

    assert messages(caplog) == ["two-factor reset step failed (RuntimeError). The API will start without it."]
    assert "secret" not in caplog.text


def test_the_dockerfile_runs_the_step_before_the_api_and_a_failure_does_not_stop_the_start() -> None:
    from pathlib import Path

    dockerfile = (Path(__file__).resolve().parents[2] / "Dockerfile").read_text()

    assert "python -m app.reset_two_factor --at-startup || echo" in dockerfile
    assert dockerfile.index("app.reset_two_factor") < dockerfile.index("uvicorn")
    assert dockerfile.index("app.bootstrap_admin") < dockerfile.index("app.reset_two_factor")
