"""Asking for a new login code. Requirements: FR-57, FR-30, NFR-06.
Spec: specs/2026-10-23-accounts-and-facility-ownership/ (Phase 2b).

`POST /auth/resend-code` takes the current code token (so the password is not sent again) and sends a
new code. The server keeps two limits, because every SMS costs money: at least 60 seconds after the
previous send (the token carries its send time), and at most 5 codes per account per hour (the first one
counts, so does a new login). The clock the routes read is replaced in these tests, so no test waits.
"""

import time
from collections.abc import Iterator
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment
from app.core import rate_limit
from app.core.security import create_access_token, create_challenge_token
from app.integrations.termii import SmsSendError
from app.main import app
from app.models import User
from app.models.base import Role
from app.services import auth_service
from tests.integration.test_auth import SmsRecorder, start_login, verify

pytestmark = pytest.mark.anyio

SOON = "Wait "
TOO_MANY = "Too many codes. Try again in "


class Clock:
    """The time the routes see: real time plus an offset the test moves by hand."""

    def __init__(self) -> None:
        self.offset = timedelta(0)

    def __call__(self) -> datetime:
        return datetime.now(timezone.utc) + self.offset

    def move(self, seconds: float) -> None:
        self.offset += timedelta(seconds=seconds)


@pytest.fixture
def clock() -> Iterator[Clock]:
    moving = Clock()
    app.dependency_overrides[get_current_moment] = moving
    yield moving
    app.dependency_overrides.pop(get_current_moment, None)


@pytest.fixture
def sms(monkeypatch: pytest.MonkeyPatch) -> SmsRecorder:
    recorder = SmsRecorder()
    monkeypatch.setattr(auth_service, "send_sms", recorder.send_sms)
    return recorder


async def resend(client: AsyncClient, challenge_token: str):
    return await client.post("/auth/resend-code", json={"challenge_token": challenge_token})


async def logged_in_to_step_two(client: AsyncClient, user: User) -> str:
    response = await start_login(client, user.email)
    assert response.status_code == 200, response.text
    return response.json()["challenge_token"]


async def test_a_new_code_before_60_seconds_is_429_with_the_seconds_left_and_sends_nothing(
    client: AsyncClient, demo_users: dict[Role, User], sms: SmsRecorder, clock: Clock
) -> None:
    token = await logged_in_to_step_two(client, demo_users[Role.editor])
    clock.move(30)

    response = await resend(client, token)

    assert response.status_code == 429
    assert response.json()["detail"].startswith(SOON)
    assert 28 <= int(response.headers["Retry-After"]) <= 31
    assert f"{response.headers['Retry-After']} seconds" in response.json()["detail"]
    assert len(sms.messages) == 1


async def test_a_new_code_after_60_seconds_sends_a_new_sms_and_a_token_that_works(
    client: AsyncClient, demo_users: dict[Role, User], sms: SmsRecorder, clock: Clock
) -> None:
    editor = demo_users[Role.editor]
    token = await logged_in_to_step_two(client, editor)
    first_code = sms.last_code
    clock.move(61)

    response = await resend(client, token)

    assert response.status_code == 200
    body = response.json()
    assert body["sent_to"] == "+234******0002"  # the same masked shape as the login answer
    assert body["challenge_token"] != token
    assert len(sms.messages) == 2
    assert sms.messages[1][0] == editor.phone
    logged_in = await verify(client, body["challenge_token"], sms.last_code)
    assert logged_in.status_code == 200
    assert first_code  # the first code was a real one too


async def test_the_60_seconds_start_again_from_the_newest_code(
    client: AsyncClient, demo_users: dict[Role, User], sms: SmsRecorder, clock: Clock
) -> None:
    token = await logged_in_to_step_two(client, demo_users[Role.editor])
    clock.move(61)
    newer = (await resend(client, token)).json()["challenge_token"]
    clock.move(30)

    response = await resend(client, newer)

    assert response.status_code == 429
    assert len(sms.messages) == 2


async def test_the_sixth_code_in_an_hour_is_429_and_says_in_minutes_when_to_try_again(
    client: AsyncClient, demo_users: dict[Role, User], sms: SmsRecorder, clock: Clock
) -> None:
    token = await logged_in_to_step_two(client, demo_users[Role.editor])  # the first code counts
    for _ in range(4):
        clock.move(61)
        response = await resend(client, token)
        assert response.status_code == 200
        token = response.json()["challenge_token"]
    assert len(sms.messages) == 5

    clock.move(61)
    sixth = await resend(client, token)

    assert sixth.status_code == 429
    assert sixth.json()["detail"].startswith(TOO_MANY)
    assert sixth.json()["detail"].endswith(" minutes.")
    assert int(sixth.headers["Retry-After"]) > 60
    assert len(sms.messages) == 5


async def test_a_new_login_counts_as_a_code_too_so_logging_in_again_cannot_get_around_the_limit(
    client: AsyncClient, demo_users: dict[Role, User], sms: SmsRecorder
) -> None:
    editor = demo_users[Role.editor]
    for _ in range(5):
        assert (await start_login(client, editor.email)).status_code == 200

    sixth = await start_login(client, editor.email)

    assert sixth.status_code == 429
    assert sixth.json()["detail"].startswith(TOO_MANY)
    assert len(sms.messages) == 5


async def test_the_limit_is_per_account_and_ends_after_the_hour(
    client: AsyncClient, demo_users: dict[Role, User], sms: SmsRecorder, monkeypatch: pytest.MonkeyPatch
) -> None:
    editor, admin = demo_users[Role.editor], demo_users[Role.admin]
    now = [time.monotonic()]
    monkeypatch.setattr(rate_limit.sms_code_limiter, "clock", lambda: now[0])
    for _ in range(5):
        await start_login(client, editor.email)
    assert (await start_login(client, editor.email)).status_code == 429

    assert (await start_login(client, admin.email)).status_code == 200  # another account is not affected
    now[0] += 3601
    assert (await start_login(client, editor.email)).status_code == 200  # an hour later it is allowed again


async def test_a_wrong_expired_or_other_kind_of_token_is_401_and_sends_nothing(
    client: AsyncClient, demo_users: dict[Role, User], sms: SmsRecorder
) -> None:
    editor = demo_users[Role.editor]
    expired = create_challenge_token(editor.id, "123456", timedelta(seconds=-1))
    tampered = (await logged_in_to_step_two(client, editor))[:-3] + "abc"
    sms.messages.clear()

    for bad in ["not-a-token", expired, tampered, create_access_token(editor.id, editor.role)]:
        response = await resend(client, bad)
        assert response.status_code == 401, bad
        assert response.json()["detail"] == "Invalid or expired code"
    assert sms.messages == []


async def test_a_new_code_for_an_account_that_stopped_being_ready_is_refused(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession, sms: SmsRecorder, clock: Clock
) -> None:
    editor = demo_users[Role.editor]
    token = await logged_in_to_step_two(client, editor)
    editor.is_active = False
    session.add(editor)
    await session.commit()
    clock.move(61)

    response = await resend(client, token)

    assert response.status_code == 403
    assert response.json()["detail"] == "This account is deactivated."
    assert len(sms.messages) == 1


async def test_when_the_sms_cannot_be_sent_there_is_a_502_and_no_new_token(
    client: AsyncClient, demo_users: dict[Role, User], sms: SmsRecorder, clock: Clock
) -> None:
    token = await logged_in_to_step_two(client, demo_users[Role.editor])
    sms.error = SmsSendError("down")
    clock.move(61)

    response = await resend(client, token)

    assert response.status_code == 502
    assert response.json()["detail"] == "Could not send the code. Try again."
    assert "challenge_token" not in response.text


async def test_the_old_code_still_works_until_it_expires_because_nothing_is_stored(
    client: AsyncClient, demo_users: dict[Role, User], sms: SmsRecorder, clock: Clock
) -> None:
    token = await logged_in_to_step_two(client, demo_users[Role.editor])
    first_code = sms.last_code
    clock.move(61)
    await resend(client, token)

    assert (await verify(client, token, first_code)).status_code == 200


async def test_the_per_address_limit_still_applies_to_the_new_route(
    client: AsyncClient, demo_users: dict[Role, User], sms: SmsRecorder
) -> None:
    for _ in range(10):
        await resend(client, "not-a-token")

    assert (await resend(client, "not-a-token")).status_code == 429


async def test_no_code_phone_token_or_password_is_logged(
    client: AsyncClient,
    demo_users: dict[Role, User],
    sms: SmsRecorder,
    clock: Clock,
    caplog: pytest.LogCaptureFixture,
) -> None:
    editor = demo_users[Role.editor]
    token = await logged_in_to_step_two(client, editor)
    clock.move(61)
    response = await resend(client, token)

    text = caplog.text
    assert sms.last_code not in text
    assert editor.phone not in text
    assert response.json()["challenge_token"] not in text
    assert token not in text
