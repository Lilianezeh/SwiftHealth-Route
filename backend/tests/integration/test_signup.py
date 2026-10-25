"""Sign-up: staff and facility owners (providers). Requirements: FR-48, FR-49, FR-56, NFR-06, NFR-07, US-17.
Spec: specs/2026-10-23-accounts-and-facility-ownership/ (Phase 3a, API only; the pages are Phase 3b).

The road: `POST /auth/signup` makes the account (not usable yet) and emails a code; `/auth/confirm-email`
checks it and texts a code to the phone; `/auth/confirm-phone` checks that. A provider can then log in; a
staff account waits for an admin (`pending`), with no access to anything. The answer of sign-up is the
same whether the email is already an account or not, and nothing is kept if the code of the email cannot
be sent. Everything is closed unless SIGNUP_ENABLED is set (off in production until the owner opens it),
and in production unless Resend is set up (a code that cannot be sent cannot be confirmed).

Decision D20 (owner, 2026-10-25): the phone is confirmed by an SMS code only when Termii is live. These
tests run with Termii live (the autouse fixture below) and the section "without Termii" turns it off:
then `confirm-email` ends the road, no SMS is sent, and the phone stays not confirmed until an admin
records a call (tests/integration/test_confirm_phone_by_call.py).
Every name, address and number here is fictional.
"""

import logging
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment
from app.core.config import settings
from app.integrations.resend import EmailNotConfiguredError, EmailSendError
from app.integrations.termii import SmsSendError
from app.main import app
from app.models import AuditEntry, User
from app.models.base import Role
from app.services import account_mail_service, signup_service, staff_alert_service
from tests.conftest import DEMO_PASSWORD
from tests.integration.test_account_state import STATES, body_for, routes_that_need_a_login
from tests.integration.test_auth import SmsRecorder, start_login, verify
from tests.staff_helpers import bearer_for

pytestmark = pytest.mark.anyio

PROVIDER = {
    "name": "Ada Owner",
    "email": "Ada.Owner@Example.com",
    "phone": "0803 000 0123",
    "password": "river78!",
    "account_type": "provider",
}
STAFF = {
    "name": "Bola Staff",
    "email": "bola.staff@example.com",
    "phone": "08030000456",
    "password": "river-bed-77",
    "account_type": "staff",
    "note": "Verifier at the clinic in Ogui; Dr Eze can vouch for me.",
}
WAITING = "This account is waiting for approval by an admin."


class MailRecorder:
    """Stands in for the account emails: the codes, and the "you already have an account" notices."""

    def __init__(self) -> None:
        self.codes: list[tuple[str, str, str]] = []  # (to, code, purpose)
        self.notices: list[str] = []
        self.error: Exception | None = None

    async def send_email_code(self, to: str, code: str, purpose: str) -> None:
        if self.error:
            raise self.error
        self.codes.append((to, code, purpose))

    async def send_account_exists_notice(self, to: str) -> None:
        self.notices.append(to)

    @property
    def last_code(self) -> str:
        return self.codes[-1][1]


class Clock:
    def __init__(self) -> None:
        self.offset = timedelta(0)

    def __call__(self) -> datetime:
        return datetime.now(timezone.utc) + self.offset

    def move(self, seconds: float) -> None:
        self.offset += timedelta(seconds=seconds)


@pytest.fixture(autouse=True)
def sign_up_is_open(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "signup_enabled", True)


@pytest.fixture(autouse=True)
def termii_is_live(monkeypatch: pytest.MonkeyPatch) -> None:
    """The SMS road of sign-up needs Termii live (D20). Sending is always replaced by the `sms` fixture."""
    monkeypatch.setattr(settings, "termii_api_key", "key-set-for-tests")


@pytest.fixture
def mail(monkeypatch: pytest.MonkeyPatch) -> MailRecorder:
    recorder = MailRecorder()
    monkeypatch.setattr(account_mail_service, "send_email_code", recorder.send_email_code)
    monkeypatch.setattr(
        account_mail_service, "send_account_exists_notice", recorder.send_account_exists_notice
    )
    return recorder


@pytest.fixture
def sms(monkeypatch: pytest.MonkeyPatch) -> SmsRecorder:
    recorder = SmsRecorder()
    monkeypatch.setattr(signup_service, "send_sms", recorder.send_sms)
    monkeypatch.setattr("app.services.auth_service.send_sms", recorder.send_sms)  # the login that follows
    return recorder


@pytest.fixture
def admin_mail(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, str, str]]:
    sent: list[tuple[str, str, str]] = []

    async def record(to: str, subject: str, body: str, **_: object) -> None:
        sent.append((to, subject, body))

    monkeypatch.setattr(staff_alert_service.resend, "send_email", record)
    return sent


@pytest.fixture
def clock() -> Clock:
    moving = Clock()
    app.dependency_overrides[get_current_moment] = moving
    yield moving
    app.dependency_overrides.pop(get_current_moment, None)


async def sign_up(client: AsyncClient, **changes: object):
    return await client.post("/auth/signup", json={**PROVIDER, **changes})


async def confirm_email(client: AsyncClient, token: str, code: str):
    return await client.post("/auth/confirm-email", json={"confirm_token": token, "code": code})


async def confirm_phone(client: AsyncClient, token: str, code: str):
    return await client.post("/auth/confirm-phone", json={"confirm_token": token, "code": code})


async def whole_road(client: AsyncClient, mail: MailRecorder, sms: SmsRecorder, person: dict) -> str:
    """Runs the three steps with the right codes; returns the status of the last answer."""
    started = await client.post("/auth/signup", json=person)
    assert started.status_code == 200, started.text
    email_step = await confirm_email(client, started.json()["confirm_token"], mail.last_code)
    assert email_step.status_code == 200, email_step.text
    phone_step = await confirm_phone(client, email_step.json()["confirm_token"], sms.last_code)
    assert phone_step.status_code == 200, phone_step.text
    return phone_step.json()["status"]


async def user_with(session: AsyncSession, email: str) -> User | None:
    return (await session.exec(select(User).where(User.email == email))).first()


# --- closed unless open ---


async def test_it_is_closed_by_default_and_nothing_is_created(
    client: AsyncClient, session: AsyncSession, mail: MailRecorder, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "signup_enabled", False)

    response = await sign_up(client)

    assert response.status_code == 503
    assert response.json()["detail"] == "Sign-up is not open yet."
    assert await user_with(session, "ada.owner@example.com") is None
    assert mail.codes == []


def test_the_setting_is_off_unless_it_is_set() -> None:
    from app.core.config import Settings

    assert Settings.model_fields["signup_enabled"].default is False


@pytest.mark.parametrize(
    ("resend_key", "termii_key"),
    [("", ""), ("", "key")],
)
async def test_outside_development_it_is_closed_until_the_email_can_be_sent_whatever_termii_is(
    client: AsyncClient,
    session: AsyncSession,
    mail: MailRecorder,
    monkeypatch: pytest.MonkeyPatch,
    resend_key: str,
    termii_key: str,
) -> None:
    """A code that cannot be sent cannot be confirmed, so no account is made that nobody can use.
    Termii does not matter for opening (D20): only the email code is always needed."""
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "resend_api_key", resend_key)
    monkeypatch.setattr(settings, "resend_from_email", "no-reply@example.test" if resend_key else "")
    monkeypatch.setattr(settings, "termii_api_key", termii_key)

    response = await sign_up(client)

    assert response.status_code == 503
    assert response.json()["detail"] == "Sign-up is not open yet."
    assert await user_with(session, "ada.owner@example.com") is None


@pytest.mark.parametrize("termii_key", ["", "key"])
async def test_outside_development_it_opens_with_resend_alone_and_with_both(
    client: AsyncClient, mail: MailRecorder, monkeypatch: pytest.MonkeyPatch, termii_key: str
) -> None:
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "resend_api_key", "key")
    monkeypatch.setattr(settings, "resend_from_email", "no-reply@example.test")
    monkeypatch.setattr(settings, "termii_api_key", termii_key)

    assert (await sign_up(client)).status_code == 200


async def test_the_same_closed_answer_is_given_for_an_email_that_is_already_an_account(
    client: AsyncClient, demo_users: dict[Role, User], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "signup_enabled", False)

    new = await sign_up(client)
    existing = await sign_up(client, email=demo_users[Role.editor].email)

    assert (new.status_code, new.json()) == (existing.status_code, existing.json())


# --- the whole road ---


async def test_a_provider_signs_up_confirms_both_codes_and_can_then_log_in(
    client: AsyncClient, session: AsyncSession, mail: MailRecorder, sms: SmsRecorder
) -> None:
    started = await sign_up(client)
    assert started.status_code == 200
    assert set(started.json()) == {"confirm_token", "sent_to"}
    assert started.json()["sent_to"] == "a***@example.com"
    assert mail.codes == [("ada.owner@example.com", mail.last_code, "email_confirm")]

    user = await user_with(session, "ada.owner@example.com")
    assert user is not None
    assert (user.role, user.name, user.phone, user.approval_status) == (
        Role.provider,
        "Ada Owner",
        "+2348030000123",
        "approved",
    )
    assert user.email_verified_at is None and user.phone_verified_at is None and user.signup_note is None
    assert user.password_hash != PROVIDER["password"]
    login = await start_login(client, "ada.owner@example.com", PROVIDER["password"])
    assert (login.status_code, login.json()["detail"]) == (403, "Confirm your email address first.")

    email_step = await confirm_email(client, started.json()["confirm_token"], mail.last_code)
    assert email_step.status_code == 200
    assert email_step.json()["status"] == "phone_code_sent"
    assert email_step.json()["sent_to"] == "+234******0123"
    assert sms.messages[-1][0] == "+2348030000123"
    login = await start_login(client, "ada.owner@example.com", PROVIDER["password"])
    assert (login.status_code, login.json()["detail"]) == (403, "Confirm your phone number first.")

    phone_step = await confirm_phone(client, email_step.json()["confirm_token"], sms.last_code)
    assert (phone_step.status_code, phone_step.json()) == (200, {"status": "active"})
    await session.refresh(user)
    assert user.email_verified_at is not None and user.phone_verified_at is not None

    login = await start_login(client, "ada.owner@example.com", PROVIDER["password"])
    assert login.status_code == 200
    token = (await verify(client, login.json()["challenge_token"], sms.last_code)).json()["access_token"]
    me = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["role"] == "provider"


async def test_sign_up_writes_no_audit_entry_until_the_second_confirmation_and_then_one_without_a_secret(
    client: AsyncClient, session: AsyncSession, mail: MailRecorder, sms: SmsRecorder
) -> None:
    started = await sign_up(client)
    assert (await session.exec(select(AuditEntry))).all() == []
    email_step = await confirm_email(client, started.json()["confirm_token"], mail.last_code)
    assert (await session.exec(select(AuditEntry))).all() == []

    await confirm_phone(client, email_step.json()["confirm_token"], sms.last_code)

    [entry] = (await session.exec(select(AuditEntry))).all()
    user = await user_with(session, "ada.owner@example.com")
    assert (entry.action, entry.user_id, entry.field_changed, entry.new_value) == (
        "signup_confirmed",
        user.id,
        "account",
        "provider (approved)",
    )
    text = " ".join(str(value) for value in entry.model_dump().values())
    assert PROVIDER["password"] not in text and "ada.owner@example.com" not in text and "0123" not in text


async def test_a_staff_account_waits_for_an_admin_and_the_admins_are_told(
    client: AsyncClient,
    session: AsyncSession,
    mail: MailRecorder,
    sms: SmsRecorder,
    admin_mail: list,
    demo_users: dict[Role, User],
) -> None:
    status = await whole_road(client, mail, sms, STAFF)

    assert status == "waiting_for_approval"
    user = await user_with(session, "bola.staff@example.com")
    assert (user.role, user.approval_status, user.signup_note) == (Role.verifier, "pending", STAFF["note"])
    assert [to for to, _subject, _body in admin_mail] == [demo_users[Role.admin].email]
    _to, subject, body = admin_mail[0]
    assert subject == "Someone is waiting for approval"
    assert "Bola Staff" in body
    assert "confirmed their email and phone" in body and "phone them" not in body
    assert "bola.staff@example.com" not in body and STAFF["password"] not in body
    login = await start_login(client, "bola.staff@example.com", STAFF["password"])
    assert (login.status_code, login.json()["detail"]) == (403, WAITING)


async def test_a_waiting_staff_account_can_use_no_route_that_needs_a_login_even_with_a_valid_token(
    client: AsyncClient, session: AsyncSession, mail: MailRecorder, sms: SmsRecorder
) -> None:
    await whole_road(client, mail, sms, STAFF)
    user = await user_with(session, "bola.staff@example.com")
    wrong = []

    for method, path in routes_that_need_a_login():
        response = await client.request(method, path, headers=bearer_for(user), json=body_for(method))
        if response.status_code != 403 or response.json().get("detail") != STATES["pending"]:
            wrong.append(f"{method} {path}: {response.status_code}")

    assert wrong == []


async def test_the_staff_note_is_kept_only_for_staff_and_a_provider_note_is_dropped(
    client: AsyncClient, session: AsyncSession, mail: MailRecorder
) -> None:
    await sign_up(client, note="please let me in")

    assert (await user_with(session, "ada.owner@example.com")).signup_note is None


# --- the password rule and the shape of the request ---


@pytest.mark.parametrize(
    ("account_type", "password", "sentence"),
    [
        ("provider", "river7!", "The password needs at least 8 characters."),
        ("staff", "river-b9!", "The password needs at least 10 characters."),
        ("provider", "password", "This password is too common. Choose another one."),
        ("staff", "qwertyuiop", "This password is too common. Choose another one."),
        ("provider", "Ada.Owner@Example.com", "The password cannot be the same as the email."),
    ],
)
async def test_the_password_rule_of_the_account_type_applies_and_the_sentence_is_plain(
    client: AsyncClient,
    session: AsyncSession,
    mail: MailRecorder,
    account_type: str,
    password: str,
    sentence: str,
) -> None:
    response = await sign_up(client, account_type=account_type, password=password)

    assert response.status_code == 422
    assert response.json()["detail"] == sentence
    assert await user_with(session, "ada.owner@example.com") is None
    assert mail.codes == []


async def test_a_provider_may_use_8_characters_and_staff_need_10(
    client: AsyncClient, mail: MailRecorder
) -> None:
    assert (await sign_up(client, password="river78!")).status_code == 200
    assert (
        await sign_up(client, email="x.staff@example.com", account_type="staff", password="river-bed!")
    ).status_code == 200


@pytest.mark.parametrize(
    "changes",
    [
        {"email": "not-an-email"},
        {"phone": "12345"},
        {"phone": ""},
        {"name": ""},
        {"name": "   "},
        {"name": "x" * 101},
        {"account_type": "admin"},
        {"account_type": "editor"},
        {"note": "x" * 501},
    ],
)
async def test_bad_input_is_422_and_nothing_is_made(
    client: AsyncClient, session: AsyncSession, mail: MailRecorder, changes: dict
) -> None:
    response = await sign_up(client, **changes)

    assert response.status_code == 422
    assert mail.codes == []
    assert await user_with(session, "ada.owner@example.com") is None


async def test_the_email_is_lower_cased_and_the_phone_is_made_international(
    client: AsyncClient, session: AsyncSession, mail: MailRecorder
) -> None:
    await sign_up(client)

    user = await user_with(session, "ada.owner@example.com")
    assert (user.email, user.phone) == ("ada.owner@example.com", "+2348030000123")


# --- without Termii (D20): one code, the phone is confirmed later by a call ---


@pytest.fixture
def no_termii(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "termii_api_key", "")


async def test_without_termii_the_email_code_ends_the_road_and_no_sms_is_sent(
    client: AsyncClient, session: AsyncSession, mail: MailRecorder, sms: SmsRecorder, no_termii: None
) -> None:
    started = await sign_up(client)

    email_step = await confirm_email(client, started.json()["confirm_token"], mail.last_code)

    assert (email_step.status_code, email_step.json()) == (200, {"status": "active"})
    assert sms.messages == []
    user = await user_with(session, "ada.owner@example.com")
    await session.refresh(user)
    assert user.email_verified_at is not None
    assert user.phone_verified_at is None  # stored, not confirmed
    assert user.phone == "+2348030000123"


async def test_without_termii_a_provider_can_log_in_after_the_email_code_and_no_phone_is_needed(
    client: AsyncClient, mail: MailRecorder, sms: SmsRecorder, no_termii: None
) -> None:
    started = await sign_up(client)
    await confirm_email(client, started.json()["confirm_token"], mail.last_code)

    login = await start_login(client, "ada.owner@example.com", PROVIDER["password"])

    assert login.status_code == 200
    token = (await verify(client, login.json()["challenge_token"], sms.last_code)).json()["access_token"]
    me = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["two_factor_enabled"] is False  # the app is offered at this first login
    assert me.json()["role"] == "provider"


async def test_without_termii_the_email_must_still_be_confirmed_before_a_login(
    client: AsyncClient, mail: MailRecorder, no_termii: None
) -> None:
    await sign_up(client)

    login = await start_login(client, "ada.owner@example.com", PROVIDER["password"])

    assert (login.status_code, login.json()["detail"]) == (403, "Confirm your email address first.")


async def test_without_termii_the_one_audit_entry_is_written_at_the_email_code_without_a_secret(
    client: AsyncClient, session: AsyncSession, mail: MailRecorder, no_termii: None
) -> None:
    started = await sign_up(client)
    assert (await session.exec(select(AuditEntry))).all() == []

    await confirm_email(client, started.json()["confirm_token"], mail.last_code)

    [entry] = (await session.exec(select(AuditEntry))).all()
    user = await user_with(session, "ada.owner@example.com")
    assert (entry.action, entry.user_id, entry.new_value) == (
        "signup_confirmed",
        user.id,
        "provider (approved)",
    )
    text = " ".join(str(value) for value in entry.model_dump().values())
    assert "0123" not in text and "ada.owner@example.com" not in text


async def test_without_termii_staff_wait_for_approval_and_the_admins_are_told_to_phone_them(
    client: AsyncClient,
    session: AsyncSession,
    mail: MailRecorder,
    admin_mail: list,
    demo_users: dict[Role, User],
    no_termii: None,
) -> None:
    started = await client.post("/auth/signup", json=STAFF)

    done = await confirm_email(client, started.json()["confirm_token"], mail.last_code)

    assert (done.status_code, done.json()) == (200, {"status": "waiting_for_approval"})
    [(to, subject, body)] = admin_mail
    assert (to, subject) == (demo_users[Role.admin].email, "Someone is waiting for approval")
    assert "Bola Staff" in body
    assert "has not confirmed their phone" in body and "phone confirmed by call" in body
    assert "bola.staff@example.com" not in body and "0456" not in body and STAFF["password"] not in body
    login = await start_login(client, "bola.staff@example.com", STAFF["password"])
    assert (login.status_code, login.json()["detail"]) == (403, WAITING)  # still nothing before approval


async def test_without_termii_a_waiting_staff_account_can_use_no_route_that_needs_a_login(
    client: AsyncClient, session: AsyncSession, mail: MailRecorder, no_termii: None
) -> None:
    started = await client.post("/auth/signup", json=STAFF)
    await confirm_email(client, started.json()["confirm_token"], mail.last_code)
    user = await user_with(session, "bola.staff@example.com")
    wrong = []

    for method, path in routes_that_need_a_login():
        response = await client.request(method, path, headers=bearer_for(user), json=body_for(method))
        if response.status_code != 403 or response.json().get("detail") != STATES["pending"]:
            wrong.append(f"{method} {path}: {response.status_code}")

    assert wrong == []


async def test_with_termii_live_the_phone_is_still_needed_before_a_login(
    client: AsyncClient, mail: MailRecorder, sms: SmsRecorder
) -> None:
    started = await sign_up(client)
    await confirm_email(client, started.json()["confirm_token"], mail.last_code)

    login = await start_login(client, "ada.owner@example.com", PROVIDER["password"])

    assert (login.status_code, login.json()["detail"]) == (403, "Confirm your phone number first.")


async def test_a_phone_token_made_while_termii_was_live_still_works_after_it_is_switched_off(
    client: AsyncClient, mail: MailRecorder, sms: SmsRecorder, monkeypatch: pytest.MonkeyPatch
) -> None:
    started = await sign_up(client)
    email_step = await confirm_email(client, started.json()["confirm_token"], mail.last_code)
    monkeypatch.setattr(settings, "termii_api_key", "")

    done = await confirm_phone(client, email_step.json()["confirm_token"], sms.last_code)

    assert (done.status_code, done.json()) == (200, {"status": "active"})


async def test_without_termii_an_email_that_is_already_an_account_gets_the_notice_and_no_restart(
    client: AsyncClient,
    session: AsyncSession,
    mail: MailRecorder,
    no_termii: None,
) -> None:
    """The first account has its email confirmed and its phone not: it must count as an account, or anyone
    who knows the email could restart it and replace its password."""
    started = await sign_up(client)
    await confirm_email(client, started.json()["confirm_token"], mail.last_code)
    before = await user_with(session, "ada.owner@example.com")
    old_hash = before.password_hash

    again = await sign_up(client, name="Someone Else", password="another-pw-88")

    assert again.status_code == 200 and set(again.json()) == {"confirm_token", "sent_to"}
    assert mail.notices == ["ada.owner@example.com"]
    assert len(mail.codes) == 1  # no second code
    await session.refresh(before)
    assert (before.name, before.password_hash) == ("Ada Owner", old_hash)
    assert before.email_verified_at is not None


# --- an email that is already an account: the same answer, nothing revealed, nothing changed ---


async def test_an_email_that_is_already_an_account_gets_the_same_answer_and_a_notice_and_no_code(
    client: AsyncClient,
    session: AsyncSession,
    demo_users: dict[Role, User],
    mail: MailRecorder,
    sms: SmsRecorder,
) -> None:
    editor = demo_users[Role.editor]
    new = await sign_up(client)
    existing = await sign_up(client, email=editor.email, name="Someone Else", password="river-bed-99")

    assert existing.status_code == new.status_code == 200
    assert set(existing.json()) == set(new.json())
    assert existing.json()["sent_to"] == "e***@demo.example.com"  # the same kind of hint
    assert [to for to, _code, _purpose in mail.codes] == [
        "ada.owner@example.com"
    ]  # no code for the existing account
    assert mail.notices == [editor.email]
    await session.refresh(editor)
    assert editor.name == "Demo Editor" and editor.approval_status == "approved"
    assert (
        await start_login(client, editor.email, DEMO_PASSWORD)
    ).status_code == 200  # its password is unchanged


async def test_the_decoy_token_of_an_existing_account_fails_like_a_wrong_code_and_confirms_nothing(
    client: AsyncClient,
    session: AsyncSession,
    demo_users: dict[Role, User],
    mail: MailRecorder,
    sms: SmsRecorder,
) -> None:
    editor = demo_users[Role.editor]
    existing = await sign_up(client, email=editor.email)

    response = await confirm_email(client, existing.json()["confirm_token"], "123456")

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or expired code"
    assert sms.messages == []


async def test_asking_again_for_an_existing_account_looks_like_asking_again_for_a_new_one_and_sends_nothing(
    client: AsyncClient, demo_users: dict[Role, User], mail: MailRecorder, clock: Clock
) -> None:
    new = await sign_up(client)
    existing = await sign_up(client, email=demo_users[Role.editor].email)
    sent_before = len(mail.codes)
    clock.move(30)

    too_soon = [
        await client.post("/auth/signup-resend-code", json={"confirm_token": token.json()["confirm_token"]})
        for token in (new, existing)
    ]
    clock.move(40)
    later = [
        await client.post("/auth/signup-resend-code", json={"confirm_token": token.json()["confirm_token"]})
        for token in (new, existing)
    ]

    assert [response.status_code for response in too_soon] == [429, 429]
    assert [response.status_code for response in later] == [200, 200]
    assert set(later[0].json()) == set(later[1].json())
    assert len(mail.codes) == sent_before + 1  # only the new account got a code


async def test_an_unfinished_sign_up_can_be_started_again_with_the_same_email_and_replaces_the_details(
    client: AsyncClient, session: AsyncSession, mail: MailRecorder, sms: SmsRecorder
) -> None:
    await sign_up(client, name="First Try", password="river78!")
    second = await sign_up(
        client, name="Second Try", password="another-pw-88", account_type="staff", phone="08030000999"
    )

    assert second.status_code == 200
    users = (await session.exec(select(User).where(User.email == "ada.owner@example.com"))).all()
    assert len(users) == 1
    user = users[0]
    assert (user.name, user.role, user.approval_status, user.phone) == (
        "Second Try",
        Role.verifier,
        "pending",
        "+2348030000999",
    )
    status = await confirm_email(client, second.json()["confirm_token"], mail.last_code)
    assert status.status_code == 200
    assert (
        await start_login(client, "ada.owner@example.com", "another-pw-88")
    ).status_code == 403  # pending, not "wrong password"


# --- the codes ---


async def test_a_wrong_code_and_a_token_of_another_kind_are_401_and_confirm_nothing(
    client: AsyncClient, session: AsyncSession, mail: MailRecorder, sms: SmsRecorder
) -> None:
    started = await sign_up(client)
    token = started.json()["confirm_token"]
    wrong = "000000" if mail.last_code != "000000" else "111111"

    for response in [
        await confirm_email(client, token, wrong),
        await confirm_email(client, "not-a-token", mail.last_code),
        await confirm_phone(client, token, mail.last_code),  # an email token is not a phone token
    ]:
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid or expired code"
    user = await user_with(session, "ada.owner@example.com")
    assert user.email_verified_at is None and sms.messages == []


async def test_an_expired_token_is_401(client: AsyncClient, mail: MailRecorder) -> None:
    from app.core.security import EMAIL_CONFIRM_PURPOSE, create_code_token

    await sign_up(client)
    expired = create_code_token(1, "123456", EMAIL_CONFIRM_PURPOSE, timedelta(seconds=-1))

    assert (await confirm_email(client, expired, "123456")).status_code == 401


async def test_the_phone_step_needs_the_email_step_first(
    client: AsyncClient, session: AsyncSession, mail: MailRecorder, sms: SmsRecorder
) -> None:
    from app.core.security import PHONE_CONFIRM_PURPOSE, create_code_token

    await sign_up(client)
    user = await user_with(session, "ada.owner@example.com")
    early = create_code_token(user.id, "123456", PHONE_CONFIRM_PURPOSE, timedelta(minutes=5))

    assert (await confirm_phone(client, early, "123456")).status_code == 401


async def test_a_code_that_was_used_cannot_be_used_again(
    client: AsyncClient, mail: MailRecorder, sms: SmsRecorder
) -> None:
    started = await sign_up(client)
    first = await confirm_email(client, started.json()["confirm_token"], mail.last_code)
    again = await confirm_email(client, started.json()["confirm_token"], mail.last_code)

    assert (first.status_code, again.status_code) == (200, 401)


async def test_ten_wrong_codes_in_an_hour_lock_the_account_s_sign_up_codes(
    client: AsyncClient, mail: MailRecorder, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.core import rate_limit

    monkeypatch.setattr(
        rate_limit.verify_code_limiter, "max_calls", 1000
    )  # this test is about the limit per account
    started = await sign_up(client)
    token = started.json()["confirm_token"]
    wrong = "000000" if mail.last_code != "000000" else "111111"
    for _ in range(10):
        assert (await confirm_email(client, token, wrong)).status_code == 401

    locked = await confirm_email(client, token, mail.last_code)

    assert locked.status_code == 429
    assert locked.json()["detail"].startswith("Too many wrong codes. Try again in ")


async def test_when_the_sms_cannot_be_sent_the_email_step_is_not_used_up_and_can_be_tried_again(
    client: AsyncClient, session: AsyncSession, mail: MailRecorder, sms: SmsRecorder
) -> None:
    started = await sign_up(client)
    sms.error = SmsSendError("down")

    failed = await confirm_email(client, started.json()["confirm_token"], mail.last_code)

    assert failed.status_code == 502
    assert failed.json()["detail"] == "Could not send the code. Try again."
    assert "confirm_token" not in failed.text
    user = await user_with(session, "ada.owner@example.com")
    await session.refresh(user)
    assert user.email_verified_at is None
    sms.error = None
    assert (await confirm_email(client, started.json()["confirm_token"], mail.last_code)).status_code == 200


async def test_when_the_email_cannot_be_sent_nothing_is_made(
    client: AsyncClient, session: AsyncSession, mail: MailRecorder
) -> None:
    mail.error = EmailSendError("down")

    response = await sign_up(client)

    assert response.status_code == 502
    assert response.json()["detail"] == "Could not send the email. Try again."
    assert await user_with(session, "ada.owner@example.com") is None


async def test_when_resend_is_not_set_up_the_email_error_is_the_closed_answer_and_nothing_is_made(
    client: AsyncClient, session: AsyncSession, mail: MailRecorder
) -> None:
    mail.error = EmailNotConfiguredError("no key")

    response = await sign_up(client)

    assert response.status_code == 503
    assert response.json()["detail"] == "Sign-up is not open yet."
    assert await user_with(session, "ada.owner@example.com") is None


# --- asking for a new code ---


async def test_a_new_email_code_waits_60_seconds_then_works_and_the_old_token_is_replaced(
    client: AsyncClient, mail: MailRecorder, sms: SmsRecorder, clock: Clock
) -> None:
    started = await sign_up(client)
    token = started.json()["confirm_token"]
    clock.move(30)
    soon = await client.post("/auth/signup-resend-code", json={"confirm_token": token})
    assert soon.status_code == 429 and soon.json()["detail"].startswith("Wait ")
    assert 28 <= int(soon.headers["Retry-After"]) <= 31
    clock.move(40)

    later = await client.post("/auth/signup-resend-code", json={"confirm_token": token})

    assert later.status_code == 200
    assert later.json()["sent_to"] == "a***@example.com"
    assert len(mail.codes) == 2
    assert (await confirm_email(client, later.json()["confirm_token"], mail.last_code)).status_code == 200


async def test_a_new_phone_code_follows_the_same_rules_and_texts_the_phone(
    client: AsyncClient, mail: MailRecorder, sms: SmsRecorder, clock: Clock
) -> None:
    started = await sign_up(client)
    email_step = await confirm_email(client, started.json()["confirm_token"], mail.last_code)
    clock.move(61)

    again = await client.post(
        "/auth/signup-resend-code", json={"confirm_token": email_step.json()["confirm_token"]}
    )

    assert again.status_code == 200
    assert again.json()["sent_to"] == "+234******0123"
    assert len(sms.messages) == 2
    assert (await confirm_phone(client, again.json()["confirm_token"], sms.last_code)).status_code == 200


async def test_the_sixth_code_in_an_hour_for_one_account_is_429(
    client: AsyncClient, mail: MailRecorder, clock: Clock
) -> None:
    token = (await sign_up(client)).json()["confirm_token"]  # the first code counts
    for _ in range(4):
        clock.move(61)
        response = await client.post("/auth/signup-resend-code", json={"confirm_token": token})
        assert response.status_code == 200
        token = response.json()["confirm_token"]
    clock.move(61)

    sixth = await client.post("/auth/signup-resend-code", json={"confirm_token": token})

    assert sixth.status_code == 429
    assert sixth.json()["detail"].startswith("Too many codes. Try again in ")


async def test_a_bad_token_for_a_new_code_is_401(client: AsyncClient, mail: MailRecorder) -> None:
    response = await client.post("/auth/signup-resend-code", json={"confirm_token": "not-a-token"})

    assert response.status_code == 401


# --- limits ---


async def test_the_fourth_sign_up_for_one_email_in_an_hour_is_429_whether_or_not_it_is_an_account(
    client: AsyncClient, demo_users: dict[Role, User], mail: MailRecorder
) -> None:
    for email in ("ada.owner@example.com", demo_users[Role.editor].email):
        for _ in range(3):
            assert (await sign_up(client, email=email)).status_code == 200
        blocked = await sign_up(client, email=email)
        assert blocked.status_code == 429
        assert blocked.json()["detail"] == "Too many sign-up attempts for this email. Try again later."


async def test_the_eleventh_sign_up_from_one_address_in_an_hour_is_429(
    client: AsyncClient, mail: MailRecorder
) -> None:
    for number in range(10):
        assert (await sign_up(client, email=f"person{number}@example.com")).status_code == 200

    assert (await sign_up(client, email="person10@example.com")).status_code == 429


# --- nothing secret is kept or shown ---


async def test_no_password_code_token_phone_or_email_is_logged(
    client: AsyncClient, mail: MailRecorder, sms: SmsRecorder, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.DEBUG):
        started = await sign_up(client)
        email_step = await confirm_email(client, started.json()["confirm_token"], mail.last_code)
        await confirm_phone(client, email_step.json()["confirm_token"], sms.last_code)

    text = caplog.text
    for secret in (
        PROVIDER["password"],
        mail.last_code,
        sms.last_code,
        started.json()["confirm_token"],
        "ada.owner@example.com",
        "0123",
    ):
        assert secret not in text


async def test_the_answers_never_hold_the_password_or_a_hash(client: AsyncClient, mail: MailRecorder) -> None:
    response = await sign_up(client)

    assert (
        PROVIDER["password"] not in response.text
        and "hash" not in response.text
        and mail.last_code not in response.text
    )


async def test_the_sign_up_routes_need_no_login(client: AsyncClient) -> None:
    paths = {path for _method, path in routes_that_need_a_login()}

    for path in ("/auth/signup", "/auth/confirm-email", "/auth/confirm-phone", "/auth/signup-resend-code"):
        assert path not in paths
