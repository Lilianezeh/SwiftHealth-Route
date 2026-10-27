"""Account self-service: details, a new email or phone, a new password, a forgotten password, closing.
Requirements: FR-54, FR-56, NFR-06, NFR-07, US-21. Spec: specs/backend/api-spec.md section 4d;
decisions D9, D10 and D13 of specs/2026-10-23-accounts-and-facility-ownership/.

The routes under /account act on the caller's own account only. A new email or phone replaces the old
one only after a code sent to the NEW one is confirmed; a changed password makes every older login token
stop working; a forgotten password is reset with a code by email and the answer never says whether the
email is an account; closing an account removes the personal data and keeps the row and the audit
entries. Every name, address and number here is fictional.
"""

import logging
from datetime import timedelta

import pytest
from httpx import AsyncClient, Response
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.core.security import (
    EMAIL_CHANGE_PURPOSE,
    PASSWORD_RESET_PURPOSE,
    PHONE_CHANGE_PURPOSE,
    create_code_token,
    decode_access_token,
)
from app.integrations import resend
from app.models import AuditEntry, User
from app.models.base import Role, utcnow
from app.repositories import user_repository
from app.services import account_mail_service, account_service
from tests.conftest import DEMO_PASSWORD
from tests.integration.test_auth import SmsRecorder, start_login
from tests.staff_helpers import bearer_for

pytestmark = pytest.mark.anyio

NEW_PASSWORD = "a-brand-new-password-91"
NEW_EMAIL = "new.address@example.com"
OLD_EMAIL = "editor@demo.example.com"
NEW_PHONE = "08030009999"
NEW_PHONE_E164 = "+2348030009999"
INVALID_CODE = "Invalid or expired code"


class MailRecorder:
    """Stands in for Resend: the codes (to, code, purpose) and the plain notices (to, subject, body)."""

    def __init__(self) -> None:
        self.codes: list[tuple[str, str, str]] = []
        self.notices: list[tuple[str, str, str]] = []

    async def send_email_code(self, to: str, code: str, purpose: str) -> None:
        self.codes.append((to, code, purpose))

    async def send_email(self, to: str, subject: str, body: str, **_: object) -> None:
        self.notices.append((to, subject, body))

    @property
    def last_code(self) -> str:
        return self.codes[-1][1]


@pytest.fixture
def mail(monkeypatch: pytest.MonkeyPatch) -> MailRecorder:
    recorder = MailRecorder()
    monkeypatch.setattr(account_mail_service, "send_email_code", recorder.send_email_code)
    monkeypatch.setattr(resend, "send_email", recorder.send_email)
    return recorder


@pytest.fixture
def sms(monkeypatch: pytest.MonkeyPatch) -> SmsRecorder:
    recorder = SmsRecorder()
    monkeypatch.setattr(account_service, "send_sms", recorder.send_sms)
    monkeypatch.setattr("app.services.auth_service.send_sms", recorder.send_sms)
    return recorder


@pytest.fixture
def termii_live(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "termii_api_key", "key-set-for-tests")


@pytest.fixture
def termii_off(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "termii_api_key", "")


async def get(client: AsyncClient, user: User) -> Response:
    return await client.get("/account", headers=bearer_for(user))


async def post(client: AsyncClient, user: User | None, path: str, body: dict) -> Response:
    return await client.post(path, headers=bearer_for(user) if user else {}, json=body)


async def start_email(client: AsyncClient, user: User, email: str = NEW_EMAIL) -> Response:
    return await post(client, user, "/account/email/start", {"email": email})


async def confirm_email(client: AsyncClient, user: User, token: str, code: str) -> Response:
    body = {"confirm_token": token, "code": code}
    return await post(client, user, "/account/email/confirm", body)


async def start_phone(client: AsyncClient, user: User, phone: str = NEW_PHONE) -> Response:
    return await post(client, user, "/account/phone/start", {"phone": phone})


async def confirm_phone(client: AsyncClient, user: User, token: str, code: str) -> Response:
    body = {"confirm_token": token, "code": code}
    return await post(client, user, "/account/phone/confirm", body)


async def change_password(
    client: AsyncClient, user: User, new: str = NEW_PASSWORD, current: str = DEMO_PASSWORD
) -> Response:
    body = {"current_password": current, "new_password": new}
    return await post(client, user, "/account/password", body)


async def close(client: AsyncClient, user: User, password: str = DEMO_PASSWORD) -> Response:
    return await post(client, user, "/account/close", {"password": password, "confirmation": "CLOSE"})


async def forgot(client: AsyncClient, email: str) -> Response:
    return await client.post("/auth/forgot-password", json={"email": email})


async def reset(client: AsyncClient, token: str, code: str, new: str = NEW_PASSWORD) -> Response:
    body = {"reset_token": token, "code": code, "new_password": new}
    return await client.post("/auth/reset-password", json=body)


async def entries(session: AsyncSession, action: str) -> list[AuditEntry]:
    query = select(AuditEntry).where(AuditEntry.action == action)
    return list((await session.exec(query)).all())


def expired(user: User, purpose: str, new_value: str | None = None) -> str:
    return create_code_token(user.id, "123456", purpose, timedelta(minutes=-1), new_value=new_value)


# --- your details ---


async def test_the_account_shows_the_caller_own_details_and_no_secret(
    client: AsyncClient, demo_users: dict[Role, User]
) -> None:
    editor = demo_users[Role.editor]

    response = await get(client, editor)

    assert response.status_code == 200
    assert response.json() == {
        "id": editor.id, "name": "Demo Editor", "email": OLD_EMAIL, "phone": editor.phone,
        "role": "editor", "approval_status": "approved", "email_confirmed": True,
        "phone_confirmed": True, "two_factor_enabled": False,
    }
    assert "hash" not in response.text and "totp" not in response.text


async def test_every_account_route_needs_a_login(client: AsyncClient) -> None:
    assert (await client.get("/account")).status_code == 401
    for path in ("email/start", "email/confirm", "phone/start", "phone/confirm", "password", "close"):
        assert (await client.post(f"/account/{path}", json={})).status_code == 401, path
    assert (await client.patch("/account", json={"name": "X"})).status_code == 401


async def test_the_name_can_be_changed_and_the_change_is_in_the_audit_log(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    editor = demo_users[Role.editor]

    response = await client.patch(
        "/account", headers=bearer_for(editor), json={"name": "  Ngozi Eze  "}
    )

    assert response.status_code == 200 and response.json()["name"] == "Ngozi Eze"
    [entry] = await entries(session, "account_update")
    assert (entry.user_id, entry.field_changed) == (editor.id, "name")
    assert (entry.old_value, entry.new_value) == ("Demo Editor", "Ngozi Eze")


@pytest.mark.parametrize("body", [{"name": ""}, {"name": "   "}, {"name": "x" * 101}, {}])
async def test_a_bad_name_is_422(
    client: AsyncClient, demo_users: dict[Role, User], body: dict
) -> None:
    response = await client.patch("/account", headers=bearer_for(demo_users[Role.editor]), json=body)

    assert response.status_code == 422


async def test_the_account_route_cannot_be_pointed_at_another_account(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    editor, verifier = demo_users[Role.editor], demo_users[Role.verifier]

    body = {"name": "Changed", "id": verifier.id}
    await client.patch("/account", headers=bearer_for(editor), json=body)

    await session.refresh(verifier)
    assert verifier.name == "Demo Verifier"


# --- a new email ---


async def test_a_new_email_gets_the_code_and_replaces_the_old_one_only_after_it(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession,
    mail: MailRecorder, sms: SmsRecorder,
) -> None:
    editor = demo_users[Role.editor]

    started = await start_email(client, editor)

    assert started.status_code == 200
    assert set(started.json()) == {"confirm_token", "sent_to"}
    assert started.json()["sent_to"] == "n***@example.com"
    assert [(to, purpose) for to, _code, purpose in mail.codes] == [(NEW_EMAIL, EMAIL_CHANGE_PURPOSE)]
    await session.refresh(editor)
    assert editor.email == OLD_EMAIL  # nothing is replaced yet
    assert (await start_login(client, OLD_EMAIL)).status_code == 200  # the old one still works

    confirmed = await confirm_email(client, editor, started.json()["confirm_token"], mail.last_code)

    assert confirmed.status_code == 200 and confirmed.json()["email"] == NEW_EMAIL
    await session.refresh(editor)
    assert editor.email == NEW_EMAIL and editor.email_verified_at is not None
    assert (await start_login(client, NEW_EMAIL)).status_code == 200
    assert (await start_login(client, OLD_EMAIL)).status_code == 401


async def test_the_old_address_is_told_and_the_audit_entry_holds_no_address(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession, mail: MailRecorder
) -> None:
    editor = demo_users[Role.editor]
    started = await start_email(client, editor)

    await confirm_email(client, editor, started.json()["confirm_token"], mail.last_code)

    [(to, _subject, body)] = mail.notices
    assert to == OLD_EMAIL
    assert NEW_EMAIL not in body and "password" not in body.lower() and "http" not in body.lower()
    [entry] = await entries(session, "account_update")
    assert (entry.field_changed, entry.old_value, entry.new_value) == ("email", "changed", "changed")
    assert NEW_EMAIL not in str(entry.model_dump())


async def test_a_wrong_code_changes_nothing(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession, mail: MailRecorder
) -> None:
    editor = demo_users[Role.editor]
    started = await start_email(client, editor)

    response = await confirm_email(client, editor, started.json()["confirm_token"], "000000")

    assert response.status_code == 400  # not 401: that means "log in again"
    assert response.json()["detail"] == INVALID_CODE
    await session.refresh(editor)
    assert editor.email == OLD_EMAIL and mail.notices == []


async def test_an_expired_code_and_a_token_of_another_kind_are_400(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession, mail: MailRecorder
) -> None:
    editor = demo_users[Role.editor]
    other_kind = create_code_token(
        editor.id, "123456", PASSWORD_RESET_PURPOSE, timedelta(minutes=5), new_value=NEW_EMAIL
    )

    for token in (expired(editor, EMAIL_CHANGE_PURPOSE, NEW_EMAIL), other_kind, "not.a.token"):
        response = await confirm_email(client, editor, token, "123456")
        assert response.status_code == 400, token

    await session.refresh(editor)
    assert editor.email == OLD_EMAIL


async def test_a_token_made_for_one_person_cannot_change_another_persons_email(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession, mail: MailRecorder
) -> None:
    editor, verifier = demo_users[Role.editor], demo_users[Role.verifier]
    started = await start_email(client, editor)

    response = await confirm_email(client, verifier, started.json()["confirm_token"], mail.last_code)

    assert response.status_code == 400
    await session.refresh(verifier)
    assert verifier.email == "verifier@demo.example.com"


async def test_an_email_another_account_has_is_refused_at_the_start_and_at_the_end(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession, mail: MailRecorder
) -> None:
    editor = demo_users[Role.editor]

    at_start = await start_email(client, editor, "Verifier@Demo.Example.com")
    assert (at_start.status_code, at_start.json()["detail"]) == (409, "That email is already used.")
    assert mail.codes == []

    started = await start_email(client, editor)
    await user_repository.create(
        session, name="Someone Else", email=NEW_EMAIL, phone="+2348030000777",
        password_hash="x", role=Role.provider,
    )
    await session.commit()
    at_end = await confirm_email(client, editor, started.json()["confirm_token"], mail.last_code)

    assert (at_end.status_code, at_end.json()["detail"]) == (409, "That email is already used.")
    await session.refresh(editor)
    assert editor.email == OLD_EMAIL


@pytest.mark.parametrize("email", ["", "not-an-email", "a@b", "x" * 300 + "@example.com"])
async def test_a_bad_email_is_422(
    client: AsyncClient, demo_users: dict[Role, User], email: str
) -> None:
    assert (await start_email(client, demo_users[Role.editor], email)).status_code == 422


async def test_the_same_email_as_now_is_refused_as_nothing_to_change(
    client: AsyncClient, demo_users: dict[Role, User], mail: MailRecorder
) -> None:
    response = await start_email(client, demo_users[Role.editor], "EDITOR@demo.example.com")

    assert response.status_code == 422
    assert mail.codes == []


async def test_codes_for_an_account_are_limited_to_five_an_hour(
    client: AsyncClient, demo_users: dict[Role, User], mail: MailRecorder
) -> None:
    editor = demo_users[Role.editor]

    for number in range(5):
        assert (await start_email(client, editor, f"n{number}@example.com")).status_code == 200
    sixth = await start_email(client, editor, "n6@example.com")

    assert sixth.status_code == 429
    assert sixth.json()["detail"].startswith("Too many codes. Try again in ")
    assert "Retry-After" in sixth.headers


async def test_ten_wrong_codes_lock_the_account_codes_for_the_hour(
    client: AsyncClient, demo_users: dict[Role, User], mail: MailRecorder
) -> None:
    editor = demo_users[Role.editor]
    token = (await start_email(client, editor)).json()["confirm_token"]

    for _ in range(10):
        assert (await confirm_email(client, editor, token, "000000")).status_code == 400
    locked = await confirm_email(client, editor, token, mail.last_code)

    assert locked.status_code == 429
    assert locked.json()["detail"].startswith("Too many wrong codes. Try again in ")


async def test_when_the_email_cannot_be_sent_the_answer_is_502(
    client: AsyncClient, demo_users: dict[Role, User], monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fail(to: str, code: str, purpose: str) -> None:
        raise resend.EmailSendError("down")

    monkeypatch.setattr(account_mail_service, "send_email_code", fail)

    response = await start_email(client, demo_users[Role.editor])

    assert (response.status_code, response.json()["detail"]) == (
        502, "Could not send the email. Try again.",
    )


async def test_when_email_is_not_set_up_the_answer_is_503(
    client: AsyncClient, demo_users: dict[Role, User], monkeypatch: pytest.MonkeyPatch
) -> None:
    async def not_configured(to: str, code: str, purpose: str) -> None:
        raise resend.EmailNotConfiguredError

    monkeypatch.setattr(account_mail_service, "send_email_code", not_configured)

    response = await start_email(client, demo_users[Role.editor])

    assert (response.status_code, response.json()["detail"]) == (503, "Email is not set up yet.")


# --- a new phone ---


async def test_with_termii_live_a_new_phone_gets_a_code_and_is_replaced_after_it(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession,
    sms: SmsRecorder, termii_live: None,
) -> None:
    editor = demo_users[Role.editor]
    old_phone = editor.phone

    started = await start_phone(client, editor)

    assert started.status_code == 200
    assert started.json()["sent_to"] == "+234******9999" and started.json()["confirm_token"]
    assert sms.messages[-1][0] == NEW_PHONE_E164
    await session.refresh(editor)
    assert editor.phone == old_phone  # not yet

    confirmed = await confirm_phone(client, editor, started.json()["confirm_token"], sms.last_code)

    assert confirmed.status_code == 200 and confirmed.json()["phone"] == NEW_PHONE_E164
    await session.refresh(editor)
    assert editor.phone == NEW_PHONE_E164 and editor.phone_verified_at is not None
    [entry] = await entries(session, "account_update")
    assert (entry.field_changed, entry.new_value) == ("phone", "changed")


async def test_with_termii_live_a_wrong_phone_code_changes_nothing(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession,
    sms: SmsRecorder, termii_live: None,
) -> None:
    editor = demo_users[Role.editor]
    old_phone = editor.phone
    started = await start_phone(client, editor)

    response = await confirm_phone(client, editor, started.json()["confirm_token"], "000000")

    assert response.status_code == 400
    await session.refresh(editor)
    assert editor.phone == old_phone


async def test_without_termii_a_new_phone_is_stored_at_once_unconfirmed_and_no_sms_is_sent(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession,
    sms: SmsRecorder, termii_off: None,
) -> None:
    editor = demo_users[Role.editor]

    response = await start_phone(client, editor)

    assert response.status_code == 200
    assert response.json() == {"confirm_token": None, "sent_to": None}
    assert sms.messages == []
    await session.refresh(editor)
    assert editor.phone == NEW_PHONE_E164 and editor.phone_verified_at is None
    [entry] = await entries(session, "account_update")
    assert (entry.field_changed, entry.new_value) == ("phone", "changed")
    assert (await get(client, editor)).json()["phone_confirmed"] is False


@pytest.mark.parametrize("phone", ["", "123", "not a phone", "+441234567890"])
async def test_a_phone_that_is_not_nigerian_is_422(
    client: AsyncClient, demo_users: dict[Role, User], phone: str
) -> None:
    assert (await start_phone(client, demo_users[Role.editor], phone)).status_code == 422


async def test_a_phone_token_of_another_kind_is_400(
    client: AsyncClient, demo_users: dict[Role, User], termii_live: None
) -> None:
    editor = demo_users[Role.editor]
    token = expired(editor, PHONE_CHANGE_PURPOSE, NEW_PHONE_E164)

    assert (await confirm_phone(client, editor, token, "123456")).status_code == 400


# --- a new password ---


async def test_a_new_password_ends_every_older_token_and_returns_a_fresh_one(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    editor = demo_users[Role.editor]
    old_headers = bearer_for(editor)
    assert (await client.get("/account", headers=old_headers)).status_code == 200

    response = await change_password(client, editor)

    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body) == {"access_token", "token_type", "expires_in"}
    assert body["token_type"] == "bearer"
    assert decode_access_token(body["access_token"]) == editor.id
    assert (await client.get("/account", headers=old_headers)).status_code == 401
    assert (await client.get("/auth/me", headers=old_headers)).status_code == 401
    fresh = {"Authorization": f"Bearer {body['access_token']}"}
    assert (await client.get("/account", headers=fresh)).status_code == 200
    await session.refresh(editor)
    assert editor.password_changed_at is not None


async def test_after_the_change_the_new_password_logs_in_and_the_old_one_does_not(
    client: AsyncClient, demo_users: dict[Role, User], sms: SmsRecorder
) -> None:
    editor = demo_users[Role.editor]
    await change_password(client, editor)

    assert (await start_login(client, editor.email, DEMO_PASSWORD)).status_code == 401
    assert (await start_login(client, editor.email, NEW_PASSWORD)).status_code == 200


async def test_the_audit_entry_of_a_password_change_holds_no_password(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    await change_password(client, demo_users[Role.editor])

    [entry] = await entries(session, "account_update")
    assert (entry.field_changed, entry.old_value, entry.new_value) == ("password", None, "changed")
    assert NEW_PASSWORD not in str(entry.model_dump())
    assert DEMO_PASSWORD not in str(entry.model_dump())


async def test_a_wrong_current_password_is_403_and_changes_nothing(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    editor = demo_users[Role.editor]
    old_hash = editor.password_hash

    response = await change_password(client, editor, current="not-the-password")

    assert (response.status_code, response.json()["detail"]) == (403, "The password is not right.")
    await session.refresh(editor)
    assert editor.password_hash == old_hash and editor.password_changed_at is None


async def test_ten_wrong_current_passwords_in_a_row_are_429(
    client: AsyncClient, demo_users: dict[Role, User]
) -> None:
    editor = demo_users[Role.editor]

    for _ in range(10):
        assert (await change_password(client, editor, current="nope")).status_code == 403
    eleventh = await change_password(client, editor)

    assert eleventh.status_code == 429


@pytest.mark.parametrize(
    ("role", "password", "ok"),
    [
        (Role.provider, "river78!", True),  # 8 characters are enough for a provider
        (Role.provider, "short7!", False),
        (Role.editor, "river78!", False),  # staff need 10
        (Role.editor, "river-bed-77", True),
        (Role.admin, "1234567890", False),  # a very common password, for everyone
    ],
)
async def test_the_password_rule_of_the_role_applies(
    client: AsyncClient, demo_users: dict[Role, User], role: Role, password: str, ok: bool
) -> None:
    response = await change_password(client, demo_users[role], password)

    assert response.status_code == (200 if ok else 422)
    if not ok:
        assert response.json()["detail"]


async def test_the_new_password_must_differ_from_the_old_one_and_from_the_email(
    client: AsyncClient, demo_users: dict[Role, User]
) -> None:
    editor = demo_users[Role.editor]

    same = await change_password(client, editor, DEMO_PASSWORD)
    as_email = await change_password(client, editor, editor.email)

    assert same.status_code == 422 and as_email.status_code == 422


# --- a forgotten password ---


async def test_forgot_password_gives_the_same_answer_for_an_account_and_an_unknown_email(
    client: AsyncClient, demo_users: dict[Role, User], mail: MailRecorder
) -> None:
    known = await forgot(client, "Editor@Demo.Example.com")
    unknown = await forgot(client, "nobody@example.com")

    assert known.status_code == unknown.status_code == 200
    assert set(known.json()) == set(unknown.json()) == {"reset_token", "sent_to"}
    assert known.json()["sent_to"] == "e***@demo.example.com"
    assert unknown.json()["sent_to"] == "n***@example.com"
    assert [to for to, _code, _purpose in mail.codes] == [OLD_EMAIL]  # nothing for the unknown one


@pytest.mark.parametrize("state", ["rejected", "closed", "inactive"])
async def test_forgot_password_sends_nothing_to_an_account_that_cannot_log_in(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession,
    mail: MailRecorder, state: str,
) -> None:
    editor = demo_users[Role.editor]
    if state == "rejected":
        editor.approval_status = "rejected"
    elif state == "closed":
        editor.closed_at, editor.is_active = utcnow(), False
    else:
        editor.is_active = False
    session.add(editor)
    await session.commit()

    response = await forgot(client, editor.email)

    assert response.status_code == 200 and set(response.json()) == {"reset_token", "sent_to"}
    assert mail.codes == []


async def test_a_reset_sets_the_password_does_not_log_in_and_ends_old_tokens(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession,
    mail: MailRecorder, sms: SmsRecorder,
) -> None:
    editor = demo_users[Role.editor]
    old_headers = bearer_for(editor)
    token = (await forgot(client, editor.email)).json()["reset_token"]

    response = await reset(client, token, mail.last_code)

    assert response.status_code == 200 and response.json() == {"reset": True}
    assert "access_token" not in response.text
    assert (await client.get("/account", headers=old_headers)).status_code == 401
    assert (await start_login(client, editor.email, DEMO_PASSWORD)).status_code == 401
    assert (await start_login(client, editor.email, NEW_PASSWORD)).status_code == 200
    [entry] = await entries(session, "account_update")
    assert (entry.user_id, entry.field_changed, entry.new_value) == (editor.id, "password", "changed")


async def test_a_reset_code_works_once(
    client: AsyncClient, demo_users: dict[Role, User], mail: MailRecorder
) -> None:
    editor = demo_users[Role.editor]
    token = (await forgot(client, editor.email)).json()["reset_token"]
    code = mail.last_code
    assert (await reset(client, token, code)).status_code == 200

    again = await reset(client, token, code, "another-password-77")

    assert again.status_code == 401


async def test_a_wrong_code_and_the_decoy_token_fail_the_same_way(
    client: AsyncClient, demo_users: dict[Role, User], mail: MailRecorder, session: AsyncSession
) -> None:
    editor = demo_users[Role.editor]
    known = (await forgot(client, editor.email)).json()["reset_token"]
    unknown = (await forgot(client, "nobody@example.com")).json()["reset_token"]

    wrong = await reset(client, known, "000000")
    decoy = await reset(client, unknown, "123456")

    assert wrong.status_code == decoy.status_code == 401
    assert wrong.json() == decoy.json() == {"detail": INVALID_CODE}
    await session.refresh(editor)
    assert editor.password_changed_at is None


async def test_a_reset_token_of_another_kind_or_expired_is_401(
    client: AsyncClient, demo_users: dict[Role, User]
) -> None:
    editor = demo_users[Role.editor]
    wrong_kind = create_code_token(editor.id, "123456", PHONE_CHANGE_PURPOSE, timedelta(minutes=5))

    for token in (wrong_kind, expired(editor, PASSWORD_RESET_PURPOSE), "garbage"):
        assert (await reset(client, token, "123456")).status_code == 401, token


async def test_a_reset_follows_the_password_rule_and_keeps_the_old_password_on_a_refusal(
    client: AsyncClient, demo_users: dict[Role, User], mail: MailRecorder, session: AsyncSession
) -> None:
    editor = demo_users[Role.editor]
    token = (await forgot(client, editor.email)).json()["reset_token"]

    response = await reset(client, token, mail.last_code, "short")

    assert response.status_code == 422
    await session.refresh(editor)
    assert editor.password_changed_at is None


async def test_a_reset_is_refused_when_the_account_was_rejected_after_the_code_was_sent(
    client: AsyncClient, demo_users: dict[Role, User], mail: MailRecorder, session: AsyncSession
) -> None:
    editor = demo_users[Role.editor]
    token = (await forgot(client, editor.email)).json()["reset_token"]
    editor.approval_status = "rejected"
    session.add(editor)
    await session.commit()

    assert (await reset(client, token, mail.last_code)).status_code == 401


async def test_forgot_password_is_limited_per_email_and_counts_unknown_emails_too(
    client: AsyncClient, mail: MailRecorder
) -> None:
    for _ in range(3):
        assert (await forgot(client, "nobody@example.com")).status_code == 200
    fourth = await forgot(client, "nobody@example.com")

    assert fourth.status_code == 429
    assert (await forgot(client, "someone.else@example.com")).status_code == 200


async def test_ten_wrong_reset_codes_lock_the_resets_of_that_account(
    client: AsyncClient, demo_users: dict[Role, User], mail: MailRecorder
) -> None:
    token = (await forgot(client, demo_users[Role.editor].email)).json()["reset_token"]

    for _ in range(10):
        assert (await reset(client, token, "000000")).status_code == 401
    locked = await reset(client, token, mail.last_code)

    assert locked.status_code == 429


async def test_forgot_password_needs_no_login_and_a_bad_email_is_422(client: AsyncClient) -> None:
    assert (await forgot(client, "not-an-email")).status_code == 422
    assert (await client.post("/auth/forgot-password", json={})).status_code == 422


# --- closing the account ---


async def test_closing_removes_personal_data_keeps_the_row_and_audit_and_blocks_the_login(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession, mail: MailRecorder
) -> None:
    editor = demo_users[Role.editor]
    session.add(
        AuditEntry(user_id=editor.id, listing_id=None, action="update", field_changed="phone")
    )
    editor.signup_note = "Verifier at the clinic."
    session.add(editor)
    await session.commit()
    old_headers = bearer_for(editor)

    response = await close(client, editor)

    assert response.status_code == 200 and response.json() == {"closed": True}
    await session.refresh(editor)
    assert editor.name == "Closed account"
    assert editor.email == f"closed-{editor.id}@closed.invalid"
    assert editor.phone is None and editor.signup_note is None
    assert editor.closed_at is not None and editor.is_active is False
    assert editor.totp_secret is None and editor.backup_code_hashes is None
    [(to, _subject, body)] = mail.notices
    assert to == OLD_EMAIL and "password" not in body.lower()
    [kept] = await entries(session, "update")
    assert kept.user_id == editor.id  # the audit entry is still there, still pointing at the row
    [closed_entry] = await entries(session, "account_close")
    assert closed_entry.user_id == editor.id
    assert OLD_EMAIL not in str(closed_entry.model_dump())
    # Closing also ends every login token (password_changed_at): the old one is refused.
    assert (await client.get("/account", headers=old_headers)).status_code == 401
    assert (await start_login(client, OLD_EMAIL)).status_code == 401  # the address is gone


async def test_closing_needs_the_right_password_and_the_typed_word(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    editor = demo_users[Role.editor]

    wrong_password = await close(client, editor, "nope")
    wrong_word = await post(
        client, editor, "/account/close", {"password": DEMO_PASSWORD, "confirmation": "close it"}
    )
    no_word = await post(client, editor, "/account/close", {"password": DEMO_PASSWORD})

    assert wrong_password.status_code == 403
    assert wrong_password.json()["detail"] == "The password is not right."
    assert wrong_word.status_code == 422 and no_word.status_code == 422
    await session.refresh(editor)
    assert editor.closed_at is None and editor.is_active is True


async def test_the_last_active_admin_cannot_close_the_account(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    admin = demo_users[Role.admin]

    response = await close(client, admin)

    assert (response.status_code, response.json()["detail"]) == (409, "This is the last active admin.")
    await session.refresh(admin)
    assert admin.closed_at is None


async def test_an_admin_can_close_the_account_when_another_active_admin_remains(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession, demo_password_hash: str
) -> None:
    await user_repository.create(
        session, name="Second Admin", email="second.admin@example.com", phone="+2348030000789",
        password_hash=demo_password_hash, role=Role.admin,
    )
    await session.commit()

    assert (await close(client, demo_users[Role.admin])).status_code == 200


async def test_the_closed_placeholder_email_cannot_be_used_to_log_in(
    client: AsyncClient, demo_users: dict[Role, User]
) -> None:
    editor = demo_users[Role.editor]
    await close(client, editor)

    login = await start_login(client, f"closed-{editor.id}@closed.invalid", DEMO_PASSWORD)

    assert login.status_code == 401


# --- what is never logged ---


async def test_no_password_code_token_email_or_phone_is_logged(
    client: AsyncClient, demo_users: dict[Role, User], mail: MailRecorder,
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.DEBUG)
    editor = demo_users[Role.editor]
    started = await start_email(client, editor)
    token = started.json()["confirm_token"]
    await confirm_email(client, editor, token, mail.last_code)
    await change_password(client, editor)
    forgotten = await forgot(client, "nobody@example.com")

    secrets = (NEW_EMAIL, NEW_PASSWORD, DEMO_PASSWORD, mail.last_code, token)
    for secret in (*secrets, forgotten.json()["reset_token"]):
        assert secret not in caplog.text, secret


async def test_the_new_routes_are_in_the_list_of_routes_that_need_a_login() -> None:
    from tests.integration.test_account_state import routes_that_need_a_login

    found = routes_that_need_a_login()

    expected = [
        ("GET", "/account"), ("PATCH", "/account"), ("POST", "/account/email/start"),
        ("POST", "/account/email/confirm"), ("POST", "/account/phone/start"),
        ("POST", "/account/phone/confirm"), ("POST", "/account/password"), ("POST", "/account/close"),
    ]
    for route in expected:
        assert route in found
    assert ("POST", "/auth/forgot-password") not in found
    assert ("POST", "/auth/reset-password") not in found
