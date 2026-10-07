"""Tests for core/security.py. Requirements: FR-30 (one-time code), NFR-06 (hashed passwords, two-factor)."""
from datetime import timedelta

import jwt
import pytest

from app.core.config import settings
from app.core.security import (
    InvalidTokenError,
    code_matches,
    create_access_token,
    create_challenge_token,
    decode_access_token,
    decode_challenge_token,
    generate_login_code,
    hash_login_code,
    hash_password,
    verify_password,
)

USER_ID = 7


def decode_without_checks(token: str) -> dict:
    """Reads a token's claims like any client could, to check what the token exposes."""
    return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])


def test_verify_password_accepts_right_and_rejects_wrong():
    password_hash = hash_password("correct horse")
    assert verify_password("correct horse", password_hash)
    assert not verify_password("wrong horse", password_hash)


def test_access_token_round_trip():
    token = create_access_token(USER_ID)
    assert decode_access_token(token) == USER_ID


def test_decoded_user_id_is_an_int():
    user_id = decode_access_token(create_access_token(USER_ID))
    claims = decode_challenge_token(create_challenge_token(USER_ID, "123456"))
    assert isinstance(user_id, int)
    assert isinstance(claims.user_id, int)


def test_sub_claim_is_stored_as_a_string():
    # Recent PyJWT versions reject a non-string "sub", so both token types store str(user_id).
    assert decode_without_checks(create_access_token(USER_ID))["sub"] == "7"
    assert decode_without_checks(create_challenge_token(USER_ID, "123456"))["sub"] == "7"


def test_expired_access_token_rejected(monkeypatch):
    monkeypatch.setattr(settings, "jwt_minutes", -1)
    with pytest.raises(InvalidTokenError):
        decode_access_token(create_access_token(USER_ID))


def test_access_token_has_no_role_claim():
    claims = decode_without_checks(create_access_token(USER_ID))
    assert "role" not in claims
    assert set(claims) == {"sub", "purpose", "exp"}


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
        decode_challenge_token(create_access_token(USER_ID))


def test_tampered_or_garbage_token_rejected():
    token = create_access_token(USER_ID)
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
