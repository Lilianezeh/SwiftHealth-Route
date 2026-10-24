"""Logging in with the authenticator app, a backup code, SMS or an email code. FR-58, FR-30, NFR-06.
Spec: specs/2026-10-23-accounts-and-facility-ownership/ (Phase 2c; the owner's answers D18 and D19).

A person with the app on is asked for the code from the app, and NO SMS is sent (that is the point: it is
free). A backup code works instead of an app code, once. A code from the app works once (the same step is
never accepted twice). SMS stays as the fallback, offered only when Termii is set up. A person without the
app gets an SMS code as before, or, while Termii is off and Resend is on, an email code (so a new account
is never left with no way to log in).
"""

import re
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core import rate_limit, secret_box, totp
from app.core.config import settings
from app.core.security import create_totp_challenge_token
from app.integrations.resend import EmailSendError
from app.models import AuditEntry, User
from app.models.base import Role
from app.services import auth_service, staff_alert_service
from tests.integration.test_auth import SmsRecorder, start_login, verify
from tests.integration.test_two_factor_setup import current_code

pytestmark = pytest.mark.anyio

LOCKED = "Too many wrong codes. Try again in "


async def app_on(session: AsyncSession, user: User) -> tuple[str, list[str]]:
    """Switches the app on straight in the database (the API set-up has its own tests)."""
    secret, codes = totp.new_secret(), totp.new_backup_codes()
    user.totp_secret = secret_box.encrypt(secret)
    user.totp_enabled_at = datetime.now(timezone.utc)
    user.backup_code_hashes = totp.hash_backup_codes(codes)
    session.add(user)
    await session.commit()
    return secret, codes


@pytest.fixture
def sms(monkeypatch: pytest.MonkeyPatch) -> SmsRecorder:
    recorder = SmsRecorder()
    monkeypatch.setattr(auth_service, "send_sms", recorder.send_sms)
    return recorder


class EmailRecorder:
    def __init__(self) -> None:
        self.sent: list[tuple[str, str, str]] = []
        self.error: Exception | None = None

    async def send_email_code(self, to: str, code: str, purpose: str) -> None:
        if self.error:
            raise self.error
        self.sent.append((to, code, purpose))


@pytest.fixture
def email(monkeypatch: pytest.MonkeyPatch) -> EmailRecorder:
    recorder = EmailRecorder()
    monkeypatch.setattr(auth_service.account_mail_service, "send_email_code", recorder.send_email_code)
    return recorder


@pytest.fixture
def termii_on(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "termii_api_key", "key-set")


@pytest.fixture
def resend_on(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "resend_api_key", "key-set")
    monkeypatch.setattr(settings, "resend_from_email", "no-reply@example.test")


# --- the app at login ---


async def test_login_with_the_app_asks_for_the_app_code_and_sends_no_sms(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession, sms: SmsRecorder
) -> None:
    editor = demo_users[Role.editor]
    await app_on(session, editor)

    response = await start_login(client, editor.email)

    assert response.status_code == 200
    assert response.json() == {
        "challenge_token": response.json()["challenge_token"],
        "sent_to": None,
        "method": "totp",
        "can_use_sms": False,
    }
    assert sms.messages == []


async def test_the_right_app_code_logs_in_and_the_same_code_cannot_be_used_twice(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession, sms: SmsRecorder
) -> None:
    editor = demo_users[Role.editor]
    secret, _codes = await app_on(session, editor)
    token = (await start_login(client, editor.email)).json()["challenge_token"]
    code = current_code(secret)

    first = await verify(client, token, code)
    assert first.status_code == 200
    assert first.json()["user"]["two_factor_enabled"] is True
    me = await client.get("/auth/me", headers={"Authorization": f"Bearer {first.json()['access_token']}"})
    assert me.status_code == 200

    second_token = (await start_login(client, editor.email)).json()["challenge_token"]
    replay = await verify(client, second_token, code)

    assert replay.status_code == 401
    assert replay.json()["detail"] == "Invalid or expired code"
    await session.refresh(editor)
    assert editor.last_login_at is not None


async def test_the_next_30_seconds_code_works_after_one_was_used(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    editor = demo_users[Role.editor]
    secret, _codes = await app_on(session, editor)
    step = totp.step_at(datetime.now(timezone.utc))
    token = (await start_login(client, editor.email)).json()["challenge_token"]
    assert (await verify(client, token, totp.code_for(secret, step))).status_code == 200

    token = (await start_login(client, editor.email)).json()["challenge_token"]

    assert (await verify(client, token, totp.code_for(secret, step + 1))).status_code == 200


async def test_a_code_typed_with_a_space_as_the_app_shows_it_works(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    editor = demo_users[Role.editor]
    secret, _codes = await app_on(session, editor)
    token = (await start_login(client, editor.email)).json()["challenge_token"]
    code = current_code(secret)

    assert (await verify(client, token, f"{code[:3]} {code[3:]}")).status_code == 200


@pytest.mark.parametrize("bad", ["000000", "", "12345", "abcdef", "1234567", "ZZZZZZZZZZ"])
async def test_a_wrong_code_is_401_with_the_usual_sentence(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession, bad: str
) -> None:
    editor = demo_users[Role.editor]
    secret, _codes = await app_on(session, editor)
    if bad == current_code(secret):
        pytest.skip("the wrong code is right this second")
    token = (await start_login(client, editor.email)).json()["challenge_token"]

    response = await verify(client, token, bad)

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or expired code"


async def test_ten_wrong_codes_in_an_hour_lock_the_second_step_of_that_account_only(
    client: AsyncClient,
    demo_users: dict[Role, User],
    session: AsyncSession,
    sms: SmsRecorder,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    editor, admin = demo_users[Role.editor], demo_users[Role.admin]
    secret, _codes = await app_on(session, editor)
    wrong = "000000" if current_code(secret) != "000000" else "111111"
    # This test is about the limit per account, so the limit per address (10 calls) is lifted.
    monkeypatch.setattr(rate_limit.login_limiter, "max_calls", 1000)
    monkeypatch.setattr(rate_limit.verify_code_limiter, "max_calls", 1000)
    token = (await start_login(client, editor.email)).json()["challenge_token"]
    for _ in range(10):
        assert (await verify(client, token, wrong)).status_code == 401

    locked = await verify(client, token, current_code(secret))

    assert locked.status_code == 429
    assert locked.json()["detail"].startswith(LOCKED)
    assert int(locked.headers["Retry-After"]) > 60
    again = await start_login(client, editor.email)  # the password step still works
    assert again.status_code == 200 and again.json()["method"] == "totp"
    other = await start_login(client, admin.email)  # another account is not affected
    assert other.status_code == 200 and other.json()["method"] == "sms"


async def test_the_tenth_wrong_code_tells_the_admins_by_email_once_and_names_no_code_or_address(
    client: AsyncClient,
    demo_users: dict[Role, User],
    session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    editor, admin = demo_users[Role.editor], demo_users[Role.admin]
    secret, _codes = await app_on(session, editor)
    wrong = "000000" if current_code(secret) != "000000" else "111111"
    monkeypatch.setattr(rate_limit.verify_code_limiter, "max_calls", 1000)
    sent: list[tuple[str, str, str]] = []

    async def record(to: str, subject: str, body: str, **options: object) -> None:
        sent.append((to, subject, body))

    monkeypatch.setattr(staff_alert_service.resend, "send_email", record)
    token = (await start_login(client, editor.email)).json()["challenge_token"]

    for _ in range(9):
        await verify(client, token, wrong)
    assert sent == []  # nine are not enough
    await verify(client, token, wrong)
    await verify(client, token, wrong)  # the eleventh is refused as locked: no second email

    assert [to for to, _subject, _body in sent] == [admin.email]
    _to, subject, body = sent[0]
    assert subject == "A second login step was locked"
    assert editor.name in body
    assert editor.email not in body and wrong not in body and secret not in body


async def test_a_backup_code_logs_in_once_in_any_case_and_with_a_dash(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    editor = demo_users[Role.editor]
    _secret, codes = await app_on(session, editor)
    typed = f"{codes[2][:5].lower()}-{codes[2][5:].lower()}"
    token = (await start_login(client, editor.email)).json()["challenge_token"]

    first = await verify(client, token, typed)
    token = (await start_login(client, editor.email)).json()["challenge_token"]
    second = await verify(client, token, codes[2])

    assert first.status_code == 200
    assert second.status_code == 401
    await session.refresh(editor)
    assert len(totp.load_hashes(editor.backup_code_hashes)) == 9
    used = (await session.exec(select(AuditEntry).where(AuditEntry.action == "two_factor_backup_used"))).all()
    assert [(row.user_id, row.new_value) for row in used] == [(editor.id, "9 left")]


async def test_backup_codes_still_work_when_the_encryption_key_is_lost_but_the_app_code_says_not_now(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    editor = demo_users[Role.editor]
    secret, codes = await app_on(session, editor)
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "totp_encryption_key", "")
    token = (await start_login(client, editor.email)).json()["challenge_token"]

    app_code = await verify(client, token, current_code(secret))
    backup = await verify(client, token, codes[0])

    assert app_code.status_code == 503
    assert app_code.json()["detail"] == "Codes from the app cannot be checked right now. Use a backup code."
    assert backup.status_code == 200


async def test_a_login_challenge_for_the_app_expires_and_a_bad_one_is_401(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    editor = demo_users[Role.editor]
    secret, _codes = await app_on(session, editor)
    expired = create_totp_challenge_token(editor.id, timedelta(seconds=-1))

    assert (await verify(client, expired, current_code(secret))).status_code == 401
    assert (await verify(client, "not-a-token", current_code(secret))).status_code == 401


async def test_an_app_challenge_is_refused_if_the_account_changed_between_the_two_steps(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    editor = demo_users[Role.editor]
    secret, _codes = await app_on(session, editor)
    token = (await start_login(client, editor.email)).json()["challenge_token"]
    editor.is_active = False
    session.add(editor)
    await session.commit()

    response = await verify(client, token, current_code(secret))

    assert response.status_code == 403
    editor.is_active = True
    editor.totp_enabled_at = None
    session.add(editor)
    await session.commit()
    assert (await verify(client, token, current_code(secret))).status_code == 401


async def test_the_new_code_button_does_not_work_for_an_app_challenge(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession, sms: SmsRecorder
) -> None:
    editor = demo_users[Role.editor]
    await app_on(session, editor)
    token = (await start_login(client, editor.email)).json()["challenge_token"]

    response = await client.post("/auth/resend-code", json={"challenge_token": token})

    assert response.status_code == 401
    assert sms.messages == []


# --- SMS as the fallback ---


async def test_sms_is_offered_only_when_termii_is_set_up_and_the_phone_is_confirmed(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    editor = demo_users[Role.editor]
    await app_on(session, editor)

    assert (await start_login(client, editor.email)).json()["can_use_sms"] is False
    monkeypatch.setattr(settings, "termii_api_key", "key-set")
    assert (await start_login(client, editor.email)).json()["can_use_sms"] is True
    editor.phone_verified_at = None
    session.add(editor)
    await session.commit()
    unconfirmed = await start_login(client, editor.email)  # unconfirmed phone: refused at the password step
    assert unconfirmed.status_code == 403


async def test_use_sms_instead_sends_an_sms_code_that_logs_in_and_counts_in_the_five_an_hour(
    client: AsyncClient,
    demo_users: dict[Role, User],
    session: AsyncSession,
    sms: SmsRecorder,
    termii_on: None,
) -> None:
    editor = demo_users[Role.editor]
    await app_on(session, editor)
    token = (await start_login(client, editor.email)).json()["challenge_token"]
    assert sms.messages == []

    response = await client.post("/auth/use-sms", json={"challenge_token": token})

    assert response.status_code == 200
    body = response.json()
    assert (body["method"], body["sent_to"], body["can_use_sms"]) == ("sms", "+234******0002", False)
    assert len(sms.messages) == 1
    assert (await verify(client, body["challenge_token"], sms.last_code)).status_code == 200
    assert rate_limit.sms_code_limiter.retry_after_seconds(f"sms:{editor.id}") == 0  # one of five used
    for _ in range(4):  # four more are allowed, the sixth is not
        await client.post("/auth/use-sms", json={"challenge_token": token})
    assert (await client.post("/auth/use-sms", json={"challenge_token": token})).status_code == 429


async def test_use_sms_instead_is_refused_when_termii_is_not_set_up_and_sends_nothing(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession, sms: SmsRecorder
) -> None:
    editor = demo_users[Role.editor]
    await app_on(session, editor)
    token = (await start_login(client, editor.email)).json()["challenge_token"]

    response = await client.post("/auth/use-sms", json={"challenge_token": token})

    assert response.status_code == 409
    assert response.json()["detail"] == "SMS codes are not available."
    assert sms.messages == []


async def test_use_sms_instead_needs_a_valid_app_challenge(
    client: AsyncClient, demo_users: dict[Role, User], sms: SmsRecorder, termii_on: None
) -> None:
    editor = demo_users[Role.editor]
    sms_token = (await start_login(client, editor.email)).json()["challenge_token"]  # SMS challenge, no app

    for bad in ["not-a-token", sms_token]:
        response = await client.post("/auth/use-sms", json={"challenge_token": bad})
        assert response.status_code == 401


# --- an email code when there is neither the app nor SMS (D19) ---


async def test_with_termii_off_and_resend_on_an_account_without_the_app_gets_an_email_code(
    client: AsyncClient, demo_users: dict[Role, User], sms: SmsRecorder, email: EmailRecorder, resend_on: None
) -> None:
    editor = demo_users[Role.editor]

    response = await start_login(client, editor.email)

    assert response.status_code == 200
    body = response.json()
    assert body["method"] == "email"
    assert body["sent_to"] == "e***@demo.example.com"  # the first letter and the domain
    assert editor.email not in body["sent_to"]
    assert sms.messages == []
    [(to, code, purpose)] = email.sent
    assert (to, purpose) == (editor.email, "login_code") and re.fullmatch(r"\d{6}", code)
    assert (await verify(client, body["challenge_token"], code)).status_code == 200


async def test_a_new_email_code_follows_the_same_60_second_and_five_an_hour_rules(
    client: AsyncClient, demo_users: dict[Role, User], email: EmailRecorder, resend_on: None
) -> None:
    editor = demo_users[Role.editor]
    token = (await start_login(client, editor.email)).json()["challenge_token"]

    too_soon = await client.post("/auth/resend-code", json={"challenge_token": token})

    assert too_soon.status_code == 429
    assert len(email.sent) == 1


async def test_an_account_with_no_phone_can_log_in_by_email_code(
    client: AsyncClient,
    demo_users: dict[Role, User],
    session: AsyncSession,
    email: EmailRecorder,
    resend_on: None,
) -> None:
    provider = demo_users[Role.provider]
    provider.phone = None
    session.add(provider)
    await session.commit()

    response = await start_login(client, provider.email)

    assert response.status_code == 200 and response.json()["method"] == "email"


async def test_when_the_email_cannot_be_sent_there_is_a_502_and_no_token(
    client: AsyncClient, demo_users: dict[Role, User], email: EmailRecorder, resend_on: None
) -> None:
    email.error = EmailSendError("down")

    response = await start_login(client, demo_users[Role.editor].email)

    assert response.status_code == 502
    assert response.json()["detail"] == "Could not send the code. Try again."
    assert "challenge_token" not in response.text


async def test_the_sms_stays_the_choice_when_termii_is_set_up_even_if_resend_is_on(
    client: AsyncClient,
    demo_users: dict[Role, User],
    sms: SmsRecorder,
    email: EmailRecorder,
    termii_on: None,
    resend_on: None,
) -> None:
    response = await start_login(client, demo_users[Role.editor].email)

    assert response.json()["method"] == "sms"
    assert len(sms.messages) == 1 and email.sent == []


async def test_with_neither_termii_nor_resend_it_is_the_sms_path_as_before_the_code_goes_to_the_log(
    client: AsyncClient, demo_users: dict[Role, User], sms: SmsRecorder, email: EmailRecorder
) -> None:
    response = await start_login(client, demo_users[Role.editor].email)

    assert response.json()["method"] == "sms"
    assert len(sms.messages) == 1 and email.sent == []
