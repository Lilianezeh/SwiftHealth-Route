"""Time-based one-time passwords (an authenticator app). Requirements: FR-58, NFR-06.
Spec: specs/2026-10-23-accounts-and-facility-ownership/ (Phase 2c).

`core/totp.py` follows RFC 6238 (SHA-1, 6 digits, 30 seconds) with the standard library only. The first
tests use the published test values of the RFC (its appendix B, secret "12345678901234567890"): its codes
have 8 digits, and a 6-digit code is the last 6 digits of the same number.
"""

import base64
from datetime import datetime, timezone

import pytest

from app.core import totp

RFC_SECRET = base64.b32encode(b"12345678901234567890").decode()
# (unix time, the RFC's 8-digit code): the 6-digit code is its last six digits.
RFC_VECTORS = [
    (59, "94287082"),
    (1111111109, "07081804"),
    (1111111111, "14050471"),
    (1234567890, "89005924"),
    (2000000000, "69279037"),
    (20000000000, "65353130"),
]


@pytest.mark.parametrize(("unix_time", "rfc_code"), RFC_VECTORS)
def test_the_codes_of_the_rfc_6238_test_values(unix_time: int, rfc_code: str) -> None:
    assert totp.code_for(RFC_SECRET, unix_time // 30) == rfc_code[-6:]


def test_a_new_secret_is_random_base32_of_160_bits_and_works_with_the_code_function() -> None:
    first, second = totp.new_secret(), totp.new_secret()

    assert first != second
    assert len(first) == 32 and set(first) <= set("ABCDEFGHIJKLMNOPQRSTUVWXYZ234567")
    assert len(base64.b32decode(first)) == 20
    assert len(totp.code_for(first, 1)) == 6


def moment(unix_time: int) -> datetime:
    return datetime.fromtimestamp(unix_time, tz=timezone.utc)


def test_the_current_step_counts_30_second_periods_from_1970() -> None:
    assert totp.step_at(moment(0)) == 0
    assert totp.step_at(moment(29)) == 0
    assert totp.step_at(moment(30)) == 1
    assert totp.step_at(moment(1111111111)) == 37037037


def test_the_right_code_is_accepted_and_gives_the_step_it_was_for() -> None:
    code = totp.code_for(RFC_SECRET, 37037037)

    assert totp.check_code(RFC_SECRET, code, None, moment(1111111111)) == 37037037


def test_one_step_either_side_is_accepted_for_a_clock_that_is_a_little_off_but_two_are_not() -> None:
    now = moment(1111111111)
    step = totp.step_at(now)

    assert totp.check_code(RFC_SECRET, totp.code_for(RFC_SECRET, step - 1), None, now) == step - 1
    assert totp.check_code(RFC_SECRET, totp.code_for(RFC_SECRET, step + 1), None, now) == step + 1
    assert totp.check_code(RFC_SECRET, totp.code_for(RFC_SECRET, step - 2), None, now) is None
    assert totp.check_code(RFC_SECRET, totp.code_for(RFC_SECRET, step + 2), None, now) is None


def test_a_step_that_was_used_is_not_accepted_again_nor_an_older_one() -> None:
    now = moment(1111111111)
    step = totp.step_at(now)
    code = totp.code_for(RFC_SECRET, step)

    assert totp.check_code(RFC_SECRET, code, step, now) is None  # the same code twice: refused
    older = totp.code_for(RFC_SECRET, step - 1)
    newer = totp.code_for(RFC_SECRET, step + 1)
    assert totp.check_code(RFC_SECRET, older, step, now) is None  # an older one: refused
    assert totp.check_code(RFC_SECRET, newer, step, now) == step + 1  # a newer one: fine


@pytest.mark.parametrize("bad", ["", "12345", "1234567", "abcdef", "12 456", "٠٠٠٠٠٠", " 123456", "123456\n"])
def test_a_wrong_or_oddly_shaped_code_is_refused_and_never_raises(bad: str) -> None:
    assert totp.check_code(RFC_SECRET, bad, None, moment(1111111111)) is None


def test_a_wrong_secret_gives_different_codes() -> None:
    other = totp.new_secret()

    assert totp.code_for(other, 37037037) != totp.code_for(RFC_SECRET, 37037037)


def test_a_code_with_a_space_in_the_middle_is_accepted_as_apps_show_it() -> None:
    """Apps print 482 913; `check_code` takes digits only, so the caller removes the space first."""
    assert totp.normalise_code("482 913") == "482913"
    assert totp.normalise_code(" 482913 ") == "482913"


def test_the_otpauth_address_has_the_issuer_the_account_and_the_secret_and_nothing_else() -> None:
    uri = totp.otpauth_uri(RFC_SECRET, "ada.staff@example.com")

    assert uri.startswith("otpauth://totp/SwiftHealth%20Route:ada.staff%40example.com?")
    assert f"secret={RFC_SECRET}" in uri
    assert "issuer=SwiftHealth%20Route" in uri
    assert "algorithm=SHA1" in uri and "digits=6" in uri and "period=30" in uri


# --- backup codes ---


def test_ten_backup_codes_of_ten_characters_without_look_alike_letters_and_all_different() -> None:
    codes = totp.new_backup_codes()

    assert len(codes) == 10 and len(set(codes)) == 10
    for code in codes:
        assert len(code) == 10
        assert set(code) <= set("ABCDEFGHJKLMNPQRSTUVWXYZ23456789")  # no 0, O, 1, I


def test_backup_codes_are_stored_only_as_keyed_hashes_and_one_is_found_and_removed() -> None:
    codes = totp.new_backup_codes()
    stored = totp.hash_backup_codes(codes)

    assert all(code not in stored for code in codes)
    assert len(totp.load_hashes(stored)) == 10  # a JSON list of ten hashes
    remaining = totp.use_backup_code(stored, codes[3])
    assert remaining is not None
    assert len(totp.load_hashes(remaining)) == 9
    assert totp.use_backup_code(remaining, codes[3]) is None  # a code works once
    assert totp.use_backup_code(remaining, codes[4]) is not None


def test_a_backup_code_is_accepted_in_any_case_with_spaces_or_dashes() -> None:
    codes = totp.new_backup_codes()
    stored = totp.hash_backup_codes(codes)
    typed = f"{codes[0][:5].lower()}-{codes[0][5:].lower()}"

    assert totp.use_backup_code(stored, typed) is not None
    assert totp.use_backup_code(stored, "WRONGWRONG") is None
    assert totp.use_backup_code(stored, "") is None
    assert totp.use_backup_code(None, codes[0]) is None


def test_the_looks_of_a_code_tells_an_app_code_from_a_backup_code() -> None:
    assert totp.looks_like_app_code("482913")
    assert totp.looks_like_app_code("482 913")
    assert not totp.looks_like_app_code("ABCDE23456")
    assert not totp.looks_like_app_code("ABCDE-23456")
    assert not totp.looks_like_app_code("")
