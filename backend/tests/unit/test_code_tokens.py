"""Signed code tokens for the email, phone and reset codes. Requirements: FR-48, FR-54, NFR-06.
Spec: specs/2026-10-23-accounts-and-facility-ownership/ (Phase 2).

Like today's login challenge token, a code token holds only the user id, its purpose and a keyed hash of the
code: nothing is stored in the database, and a purpose cannot be used for another (an email code is not a
phone code, a code token is not an access token).
"""

from datetime import timedelta

import pytest

from app.core.security import (
    EMAIL_CONFIRM_PURPOSE,
    PASSWORD_RESET_PURPOSE,
    PHONE_CONFIRM_PURPOSE,
    InvalidTokenError,
    code_matches,
    create_access_token,
    create_challenge_token,
    create_code_token,
    decode_access_token,
    decode_challenge_token,
    decode_code_token,
)

PURPOSES = [EMAIL_CONFIRM_PURPOSE, PHONE_CONFIRM_PURPOSE, PASSWORD_RESET_PURPOSE]


@pytest.mark.parametrize("purpose", PURPOSES)
def test_the_right_code_matches_and_a_wrong_one_does_not(purpose: str) -> None:
    token = create_code_token(7, "004821", purpose, timedelta(minutes=5))

    claims = decode_code_token(token, purpose)

    assert claims.user_id == 7
    assert code_matches(7, "004821", claims.code_hash)
    assert not code_matches(7, "004822", claims.code_hash)


def test_the_code_is_tied_to_the_user() -> None:
    token = create_code_token(7, "004821", EMAIL_CONFIRM_PURPOSE, timedelta(minutes=5))

    claims = decode_code_token(token, EMAIL_CONFIRM_PURPOSE)

    assert not code_matches(8, "004821", claims.code_hash)


def test_the_token_holds_no_plain_code() -> None:
    token = create_code_token(7, "004821", EMAIL_CONFIRM_PURPOSE, timedelta(minutes=5))

    assert "004821" not in token


def test_a_token_is_only_good_for_its_own_purpose() -> None:
    email_token = create_code_token(7, "004821", EMAIL_CONFIRM_PURPOSE, timedelta(minutes=5))

    for other in (PHONE_CONFIRM_PURPOSE, PASSWORD_RESET_PURPOSE):
        with pytest.raises(InvalidTokenError):
            decode_code_token(email_token, other)


def test_an_expired_token_is_refused() -> None:
    token = create_code_token(7, "004821", PHONE_CONFIRM_PURPOSE, timedelta(seconds=-1))

    with pytest.raises(InvalidTokenError):
        decode_code_token(token, PHONE_CONFIRM_PURPOSE)


def test_a_tampered_token_is_refused() -> None:
    token = create_code_token(7, "004821", EMAIL_CONFIRM_PURPOSE, timedelta(minutes=5))
    tampered = token[:-3] + ("AAA" if not token.endswith("AAA") else "BBB")

    with pytest.raises(InvalidTokenError):
        decode_code_token(tampered, EMAIL_CONFIRM_PURPOSE)
    with pytest.raises(InvalidTokenError):
        decode_code_token("not-a-token", EMAIL_CONFIRM_PURPOSE)


def test_the_other_token_types_cannot_stand_in_for_a_code_token_and_the_other_way_round() -> None:
    code_token = create_code_token(7, "004821", EMAIL_CONFIRM_PURPOSE, timedelta(minutes=5))

    with pytest.raises(InvalidTokenError):
        decode_access_token(code_token)
    with pytest.raises(InvalidTokenError):
        decode_challenge_token(code_token)
    with pytest.raises(InvalidTokenError):
        decode_code_token(create_access_token(7), EMAIL_CONFIRM_PURPOSE)
    with pytest.raises(InvalidTokenError):
        decode_code_token(create_challenge_token(7, "004821"), EMAIL_CONFIRM_PURPOSE)


def test_the_login_challenge_still_works_as_before() -> None:
    claims = decode_challenge_token(create_challenge_token(7, "004821"))

    assert claims.user_id == 7
    assert code_matches(7, "004821", claims.code_hash)


def test_the_lifetimes_are_15_minutes_for_email_and_reset_and_5_for_the_phone() -> None:
    from app.core import security

    assert security.EMAIL_CODE_LIFETIME == timedelta(minutes=15)
    assert security.PASSWORD_RESET_LIFETIME == timedelta(minutes=15)
    assert security.PHONE_CODE_LIFETIME == timedelta(minutes=5)
