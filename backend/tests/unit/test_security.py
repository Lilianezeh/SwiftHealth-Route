"""Tests for core/security.py. Requirements: FR-30 (one-time code), NFR-06 (hashed passwords, two-factor)."""
import hashlib
import hmac
from datetime import datetime, timedelta, timezone

import jwt
import pytest

from app.core.config import settings
from app.core.security import (
    InvalidTokenError,
    code_matches,
    create_access_token,
    create_challenge_token,
    decode_access_claims,
    decode_access_token,
    decode_challenge_token,
    generate_login_code,
    hash_login_code,
    hash_password,
    hash_reporter_key,
    idle_limit_for,
    verify_password,
)
from app.models.base import Role

USER_ID = 7


def decode_without_checks(token: str) -> dict:
    """Reads a token's claims like any client could, to check what the token exposes."""
    return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])


def test_verify_password_accepts_right_and_rejects_wrong():
    password_hash = hash_password("correct horse")
    assert verify_password("correct horse", password_hash)
    assert not verify_password("wrong horse", password_hash)


def test_hash_password_uses_argon2():
    assert hash_password("correct horse").startswith("$argon2")


def test_same_password_gives_different_hashes():
    assert hash_password("correct horse") != hash_password("correct horse")  # random salt each time


def test_verify_password_rejects_a_bcrypt_hash():
    # A bcrypt-format hash. pwdlib raises UnknownHashError for it; verify_password turns that into False.
    bcrypt_hash = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO5bW1pqHqVJ3JQmb3GxGxq4Qm4Zk2n6e"
    assert verify_password("correct horse", bcrypt_hash) is False


@pytest.mark.parametrize("unreadable_hash", ["not-a-hash", ""])
def test_verify_password_rejects_garbage_hash(unreadable_hash):
    assert verify_password("correct horse", unreadable_hash) is False


def test_access_token_round_trip():
    token = create_access_token(USER_ID, Role.editor)
    assert decode_access_token(token) == USER_ID


def test_decoded_user_id_is_an_int():
    user_id = decode_access_token(create_access_token(USER_ID, Role.editor))
    claims = decode_challenge_token(create_challenge_token(USER_ID, "123456"))
    assert isinstance(user_id, int)
    assert isinstance(claims.user_id, int)


def test_sub_claim_is_stored_as_a_string():
    # Recent PyJWT versions reject a non-string "sub", so both token types store str(user_id).
    assert decode_without_checks(create_access_token(USER_ID, Role.editor))["sub"] == "7"
    assert decode_without_checks(create_challenge_token(USER_ID, "123456"))["sub"] == "7"


@pytest.mark.parametrize(("role", "setting"), [
    (Role.admin, "idle_minutes_admin"), (Role.editor, "idle_minutes_other"),
    (Role.verifier, "idle_minutes_other"), (Role.provider, "idle_minutes_other"),
])
def test_expired_access_token_rejected(monkeypatch, role, setting):
    monkeypatch.setattr(settings, setting, -1)
    with pytest.raises(InvalidTokenError):
        decode_access_token(create_access_token(USER_ID, role))


def test_access_token_has_no_role_claim():
    claims = decode_without_checks(create_access_token(USER_ID, Role.admin))
    assert "role" not in claims
    # `ims` is the moment the token was made, in milliseconds (a password change ends older tokens, D10).
    # `sts` is when the whole session began: a renewed token keeps it (the longest session, jwt_minutes).
    assert set(claims) == {"sub", "purpose", "exp", "ims", "sts"}
    assert isinstance(claims["ims"], int)
    assert claims["sts"] == claims["ims"]


def test_the_idle_limit_is_5_minutes_for_an_admin_15_for_the_rest_and_both_are_settings(monkeypatch):
    assert idle_limit_for(Role.admin) == timedelta(minutes=5)
    for role in (Role.editor, Role.verifier, Role.provider):
        assert idle_limit_for(role) == timedelta(minutes=15)
    monkeypatch.setattr(settings, "idle_minutes_admin", 9)
    monkeypatch.setattr(settings, "idle_minutes_other", 30)
    assert idle_limit_for(Role.admin) == timedelta(minutes=9)
    assert idle_limit_for(Role.provider) == timedelta(minutes=30)


def test_a_token_expires_after_the_idle_limit_of_its_role():
    for role in (Role.admin, Role.editor):
        claims = decode_access_claims(create_access_token(USER_ID, role))
        lifetime = claims.expires_at - datetime.now(timezone.utc)
        assert idle_limit_for(role) - timedelta(seconds=5) < lifetime <= idle_limit_for(role)


def test_a_renewed_token_keeps_the_moment_the_session_began():
    began = 1_700_000_000_000
    claims = decode_access_claims(create_access_token(USER_ID, Role.editor, session_started_ms=began))
    assert claims.session_started_ms == began
    assert claims.issued_ms is not None and claims.issued_ms > began


def test_the_issue_time_is_read_back_and_an_old_token_without_it_reads_as_none():
    import jwt

    from app.core.config import settings
    from app.core.security import decode_access_claims

    fresh = decode_access_claims(create_access_token(USER_ID, Role.editor))
    assert fresh.user_id == USER_ID and fresh.issued_ms is not None

    old = jwt.encode(
        {"sub": str(USER_ID), "purpose": "access", "exp": 4_102_444_800},
        settings.jwt_secret,
        algorithm="HS256",
    )
    assert decode_access_claims(old).issued_ms is None
    assert decode_access_claims(old).session_started_ms is None  # then `ims` stands in for it


def test_challenge_token_does_not_contain_plain_code():
    code = "482913"
    token = create_challenge_token(USER_ID, code)
    claims = decode_without_checks(token)
    assert code not in claims.values()
    assert code not in token


def test_challenge_token_carries_a_hash_that_matches_only_the_right_code():
    claims = decode_challenge_token(create_challenge_token(USER_ID, "482913"))
    assert code_matches(USER_ID, "482913", claims.code_hash)
    assert not code_matches(USER_ID, "482914", claims.code_hash)
    assert not code_matches(USER_ID + 1, "482913", claims.code_hash)


def test_code_hash_depends_on_the_server_secret(monkeypatch):
    original_hash = hash_login_code(USER_ID, "482913")
    monkeypatch.setattr(settings, "jwt_secret", "a-different-secret")
    assert hash_login_code(USER_ID, "482913") != original_hash


def test_expired_challenge_token_rejected():
    token = create_challenge_token(USER_ID, "482913", expires_delta=timedelta(minutes=-1))
    with pytest.raises(InvalidTokenError):
        decode_challenge_token(token)


def test_challenge_token_rejected_as_access_token():
    with pytest.raises(InvalidTokenError):
        decode_access_token(create_challenge_token(USER_ID, "482913"))


def test_access_token_rejected_as_challenge():
    with pytest.raises(InvalidTokenError):
        decode_challenge_token(create_access_token(USER_ID, Role.editor))


def test_tampered_or_garbage_token_rejected():
    token = create_access_token(USER_ID, Role.editor)
    with pytest.raises(InvalidTokenError):
        decode_access_token(token[:-2] + "xx")
    with pytest.raises(InvalidTokenError):
        decode_access_token("not-a-token")


def test_login_code_is_six_digits_with_leading_zeros_kept(monkeypatch):
    monkeypatch.setattr("app.core.security.secrets.randbelow", lambda upper_bound: 4821)
    assert generate_login_code() == "004821"


def test_generated_codes_are_always_six_digits():
    for _ in range(200):
        code = generate_login_code()
        assert len(code) == 6
        assert code.isdigit()


# --- hash_reporter_key: counts different reporters for FR-22 without storing a phone or an IP (NFR-07) ---

A_PHONE = "+2340000000042"
AN_IP = "203.0.113.7"  # a documentation address, not a real client


def test_reporter_key_is_a_64_character_hex_string():
    reporter_key = hash_reporter_key(A_PHONE)
    assert len(reporter_key) == 64
    assert set(reporter_key) <= set("0123456789abcdef")


def test_same_value_gives_the_same_reporter_key():
    assert hash_reporter_key(A_PHONE) == hash_reporter_key(A_PHONE)  # so two reports can be matched


def test_different_values_give_different_reporter_keys():
    assert hash_reporter_key(A_PHONE) != hash_reporter_key("+2340000000043")
    assert hash_reporter_key(AN_IP) != hash_reporter_key("203.0.113.8")


def test_reporter_key_depends_on_the_reporter_key_secret(monkeypatch):
    original_key = hash_reporter_key(A_PHONE)
    monkeypatch.setattr(settings, "reporter_key_secret", "a-different-reporter-secret")
    assert hash_reporter_key(A_PHONE) != original_key


def test_reporter_key_does_not_depend_on_jwt_secret(monkeypatch):
    # The reason for a separate secret: rotating JWT_SECRET must not break FR-22 counting (decision 6).
    original_key = hash_reporter_key(A_PHONE)
    monkeypatch.setattr(settings, "jwt_secret", "a-rotated-jwt-secret")
    assert hash_reporter_key(A_PHONE) == original_key


@pytest.mark.parametrize("value", [A_PHONE, AN_IP])
def test_reporter_key_does_not_contain_the_phone_or_the_ip(value):
    assert value not in hash_reporter_key(value)
    assert value.lstrip("+") not in hash_reporter_key(value)


@pytest.mark.parametrize("value", [A_PHONE, AN_IP])
def test_reporter_key_is_not_a_plain_hash(value):
    # A plain SHA-256 of a phone number could be reversed by trying every Nigerian number.
    assert hash_reporter_key(value) != hashlib.sha256(value.encode()).hexdigest()
    assert hash_reporter_key(value) != hashlib.sha256(f"reporter:{value}".encode()).hexdigest()


def test_reporter_key_uses_the_reporter_label_and_the_reporter_secret():
    expected = hmac.new(
        settings.reporter_key_secret.encode(), f"reporter:{A_PHONE}".encode(), hashlib.sha256
    ).hexdigest()
    assert hash_reporter_key(A_PHONE) == expected


def test_reporter_key_differs_from_a_login_code_hash_of_the_same_text(monkeypatch):
    # Even if the two secrets were ever equal, the label keeps one use from matching the other.
    monkeypatch.setattr(settings, "reporter_key_secret", settings.jwt_secret)
    assert hash_reporter_key("7:482913") != hash_login_code(7, "482913")
