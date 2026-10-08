"""Login, verify-code and /auth/me through HTTP. Requirements: FR-30 (password plus one-time code), NFR-06.

The SMS send is replaced by a recorder, so the tests read the login code from the message it would have sent.
Users come from the `demo_users` fixture; they all share DEMO_PASSWORD and have fictional +2340... phones.
"""
import logging
import re
from datetime import timedelta

import jwt
import pytest

from app.core.config import settings
from app.core.security import create_access_token, create_challenge_token
from app.integrations.termii import SmsSendError
from app.models.base import Role
from app.services import auth_service
from tests.conftest import DEMO_PASSWORD

pytestmark = pytest.mark.anyio

WRONG_LOGIN_MESSAGE = "Invalid email or password"
SMS_FAILED_MESSAGE = "Could not send the code. Try again."


class SmsRecorder:
    """Stands in for integrations.termii.send_sms: remembers each message, or fails when told to."""

    def __init__(self) -> None:
        self.messages: list[tuple[str, str]] = []
        self.error: Exception | None = None

    async def send_sms(self, phone: str, message: str) -> None:
        if self.error:
            raise self.error
        self.messages.append((phone, message))

    @property
    def last_code(self) -> str:
        return re.search(r"\b(\d{6})\b", self.messages[-1][1]).group(1)


@pytest.fixture
def sms(monkeypatch) -> SmsRecorder:
    recorder = SmsRecorder()
    monkeypatch.setattr(auth_service, "send_sms", recorder.send_sms)
    return recorder


async def start_login(client, email: str, password: str = DEMO_PASSWORD):
    return await client.post("/auth/login", json={"email": email, "password": password})


async def verify(client, challenge_token: str, code: str):
    return await client.post("/auth/verify-code", json={"challenge_token": challenge_token, "code": code})


async def log_in(client, sms: SmsRecorder, user) -> str:
    """Runs both steps and returns the access token."""
    challenge_token = (await start_login(client, user.email)).json()["challenge_token"]
    return (await verify(client, challenge_token, sms.last_code)).json()["access_token"]


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# --- POST /auth/login ---

async def test_login_wrong_password_401(client, demo_users, sms):
    response = await start_login(client, demo_users[Role.admin].email, "not-the-password")
    assert response.status_code == 401
    assert response.json()["detail"] == WRONG_LOGIN_MESSAGE
    assert sms.messages == []


async def test_login_unknown_email_401_same_message(client, demo_users, sms):
    wrong_password = await start_login(client, demo_users[Role.admin].email, "not-the-password")
    unknown_email = await start_login(client, "nobody@demo.example.com")
    assert unknown_email.status_code == 401
    assert unknown_email.json() == wrong_password.json()
    assert sms.messages == []


async def test_login_inactive_user_403(client, demo_users, session, sms):
    inactive_user = demo_users[Role.editor]
    inactive_user.is_active = False
    await session.commit()
    response = await start_login(client, inactive_user.email)
    assert response.status_code == 403
    assert sms.messages == []


async def test_login_wrong_password_for_inactive_user_is_401(client, demo_users, session, sms):
    # The inactive check comes only after the password is right, so it does not reveal the account state.
    inactive_user = demo_users[Role.editor]
    inactive_user.is_active = False
    await session.commit()
    response = await start_login(client, inactive_user.email, "not-the-password")
    assert response.status_code == 401
    assert response.json()["detail"] == WRONG_LOGIN_MESSAGE


async def test_login_no_phone_400(client, demo_users, session, sms):
    user = demo_users[Role.provider]
    user.phone = None
    await session.commit()
    response = await start_login(client, user.email)
    assert response.status_code == 400
    assert sms.messages == []


async def test_login_returns_masked_phone_and_sends_code(client, demo_users, sms):
    user = demo_users[Role.verifier]
    response = await start_login(client, user.email)
    assert response.status_code == 200
    body = response.json()
    assert body["sent_to"] == "+234******0001"
    assert body["challenge_token"]
    assert [phone for phone, _ in sms.messages] == [user.phone]
    assert re.fullmatch(r"\d{6}", sms.last_code)
    assert sms.last_code not in response.text  # the code travels only by SMS
    assert user.phone not in response.text


async def test_login_sms_failure_502_and_no_challenge_token(client, demo_users, sms):
    sms.error = SmsSendError("Termii answered with HTTP 500.")
    response = await start_login(client, demo_users[Role.admin].email)
    assert response.status_code == 502
    assert response.json()["detail"] == SMS_FAILED_MESSAGE
    assert "challenge_token" not in response.text


async def test_login_11th_attempt_429(client, demo_users, sms):
    for _ in range(10):
        assert (await start_login(client, "nobody@demo.example.com")).status_code == 401
    response = await start_login(client, demo_users[Role.admin].email)
    assert response.status_code == 429


# --- POST /auth/verify-code ---

async def test_verify_wrong_code_401(client, demo_users, sms):
    challenge_token = (await start_login(client, demo_users[Role.admin].email)).json()["challenge_token"]
    wrong_code = "000000" if sms.last_code != "000000" else "111111"
    response = await verify(client, challenge_token, wrong_code)
    assert response.status_code == 401


@pytest.mark.parametrize("malformed_code", ["", "abc123", "12345", "1234567", " 123456", "123 456"])
async def test_verify_malformed_code_401_never_500(client, demo_users, sms, malformed_code):
    challenge_token = (await start_login(client, demo_users[Role.admin].email)).json()["challenge_token"]
    response = await verify(client, challenge_token, malformed_code)
    assert response.status_code == 401


async def test_verify_keeps_leading_zeros(client, demo_users, sms, monkeypatch):
    monkeypatch.setattr(auth_service, "generate_login_code", lambda: "004821")
    challenge_token = (await start_login(client, demo_users[Role.admin].email)).json()["challenge_token"]
    assert (await verify(client, challenge_token, "4821")).status_code == 401
    assert (await verify(client, challenge_token, "004821")).status_code == 200


async def test_verify_expired_challenge_401(client, demo_users):
    user = demo_users[Role.admin]
    expired_token = create_challenge_token(user.id, "123456", expires_delta=timedelta(seconds=-1))
    response = await verify(client, expired_token, "123456")
    assert response.status_code == 401


async def test_verify_garbage_or_wrong_type_token_401(client, demo_users):
    user = demo_users[Role.admin]
    for bad_token in ("garbage", "", create_access_token(user.id)):  # an access token is not a challenge
        assert (await verify(client, bad_token, "123456")).status_code == 401


async def test_verify_tampered_challenge_401(client, demo_users):
    admin, editor = demo_users[Role.admin], demo_users[Role.editor]
    real_token = create_challenge_token(admin.id, "123456")
    claims = jwt.decode(real_token, settings.jwt_secret, algorithms=["HS256"])
    # Signed with the wrong key: the signature check fails.
    forged_token = jwt.encode(claims, "x" * 40, algorithm="HS256")
    assert (await verify(client, forged_token, "123456")).status_code == 401
    # Correctly signed but pointing at another user: the code hash was made for the admin, so no match.
    swapped_token = jwt.encode({**claims, "sub": str(editor.id)}, settings.jwt_secret, algorithm="HS256")
    assert (await verify(client, swapped_token, "123456")).status_code == 401


async def test_verify_inactive_user_403(client, demo_users, session, sms):
    user = demo_users[Role.editor]
    challenge_token = (await start_login(client, user.email)).json()["challenge_token"]
    user.is_active = False  # deactivated between the two steps
    await session.commit()
    response = await verify(client, challenge_token, sms.last_code)
    assert response.status_code == 403


async def test_verify_sets_last_login_at(client, demo_users, session, sms):
    user = demo_users[Role.admin]
    assert user.last_login_at is None
    challenge_token = (await start_login(client, user.email)).json()["challenge_token"]
    assert (await verify(client, challenge_token, sms.last_code)).status_code == 200
    await session.refresh(user)
    assert user.last_login_at is not None


async def test_verify_returns_a_token_and_the_user_without_secrets(client, demo_users, sms):
    user = demo_users[Role.provider]
    challenge_token = (await start_login(client, user.email)).json()["challenge_token"]
    code = sms.last_code
    response = await verify(client, challenge_token, code)
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["expires_in"] == settings.jwt_minutes * 60
    assert body["user"] == {
        "id": user.id, "name": user.name, "email": user.email, "phone": user.phone,
        "role": "provider", "is_active": True,
    }
    assert "password_hash" not in response.text
    assert code not in response.text


async def test_verify_code_11th_attempt_429(client, demo_users, sms):
    challenge_token = (await start_login(client, demo_users[Role.admin].email)).json()["challenge_token"]
    for _ in range(10):
        assert (await verify(client, challenge_token, "abc")).status_code == 401
    response = await verify(client, challenge_token, sms.last_code)
    assert response.status_code == 429


# --- GET /auth/me ---

async def test_access_token_works_on_me(client, demo_users, sms):
    user = demo_users[Role.verifier]
    token = await log_in(client, sms, user)
    response = await client.get("/auth/me", headers=bearer(token))
    assert response.status_code == 200
    assert response.json()["email"] == user.email
    assert response.json()["role"] == "verifier"


async def test_me_without_token_401(client, demo_users):
    assert (await client.get("/auth/me")).status_code == 401


async def test_me_with_a_bad_token_401(client, demo_users):
    user = demo_users[Role.admin]
    for bad_token in ("garbage", create_challenge_token(user.id, "123456")):  # a challenge is no access token
        assert (await client.get("/auth/me", headers=bearer(bad_token))).status_code == 401


async def test_me_for_a_deleted_user_401(client, demo_users, session):
    user = demo_users[Role.admin]
    token = create_access_token(user.id)
    await session.delete(user)
    await session.commit()
    assert (await client.get("/auth/me", headers=bearer(token))).status_code == 401


async def test_me_deactivated_user_403(client, demo_users, session):
    user = demo_users[Role.editor]
    token = create_access_token(user.id)
    user.is_active = False
    await session.commit()
    assert (await client.get("/auth/me", headers=bearer(token))).status_code == 403


async def test_me_uses_role_from_database(client, demo_users, session):
    user = demo_users[Role.verifier]
    token = create_access_token(user.id)
    assert (await client.get("/auth/me", headers=bearer(token))).json()["role"] == "verifier"
    user.role = Role.admin  # promoted after the token was issued
    await session.commit()
    assert (await client.get("/auth/me", headers=bearer(token))).json()["role"] == "admin"


# --- NFR-06: nothing secret in the logs ---

async def test_login_and_verify_never_log_the_password_or_the_code(client, demo_users, sms, caplog):
    with caplog.at_level(logging.DEBUG):
        await log_in(client, sms, demo_users[Role.admin])
    assert DEMO_PASSWORD not in caplog.text
    assert sms.last_code not in caplog.text
