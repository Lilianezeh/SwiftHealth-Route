"""Encrypting the authenticator secret in the database. FR-58, NFR-06. Owner's answer D18 (2026-10-24).
Spec: specs/2026-10-23-accounts-and-facility-ownership/ (Phase 2c).

The secret must be readable by the server to check a code, so it is stored encrypted with a key that is
NOT in the database (the variable TOTP_ENCRYPTION_KEY: a Fernet key, 32 random bytes in URL-safe base64,
from the `cryptography` package; no encryption of our own). In development a public development key is
used so nothing has to be set up; it is refused anywhere else. With no usable key the set-up says "not
available yet" and nothing is ever stored in the clear.
"""

import base64
import logging

import pytest
from cryptography.fernet import Fernet

from app.core import secret_box
from app.core.config import settings

REAL_KEY = Fernet.generate_key().decode()


@pytest.fixture
def production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "totp_encryption_key", REAL_KEY)


def test_a_secret_goes_in_encrypted_and_comes_out_the_same(production: None) -> None:
    stored = secret_box.encrypt("JBSWY3DPEHPK3PXP")

    assert "JBSWY3DPEHPK3PXP" not in stored
    assert secret_box.decrypt(stored) == "JBSWY3DPEHPK3PXP"


def test_the_same_secret_is_stored_differently_each_time(production: None) -> None:
    assert secret_box.encrypt("JBSWY3DPEHPK3PXP") != secret_box.encrypt("JBSWY3DPEHPK3PXP")


def test_a_different_key_cannot_read_it(production: None, monkeypatch: pytest.MonkeyPatch) -> None:
    stored = secret_box.encrypt("JBSWY3DPEHPK3PXP")
    monkeypatch.setattr(settings, "totp_encryption_key", Fernet.generate_key().decode())

    with pytest.raises(secret_box.SecretBoxError):
        secret_box.decrypt(stored)


def test_a_tampered_or_empty_value_is_an_error_not_a_crash(production: None) -> None:
    stored = secret_box.encrypt("JBSWY3DPEHPK3PXP")

    for bad in (stored[:-4] + "AAAA", "", "not-fernet"):
        with pytest.raises(secret_box.SecretBoxError):
            secret_box.decrypt(bad)


def test_with_no_key_outside_development_it_is_not_available(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "totp_encryption_key", "")

    assert secret_box.is_available() is False
    with pytest.raises(secret_box.SecretBoxUnavailableError):
        secret_box.encrypt("JBSWY3DPEHPK3PXP")
    with pytest.raises(secret_box.SecretBoxUnavailableError):
        secret_box.decrypt("anything")


def test_a_key_that_is_not_a_fernet_key_is_not_available_and_is_never_shown(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "totp_encryption_key", "this-is-not-a-fernet-key-but-has-no-secret")

    with caplog.at_level(logging.DEBUG):
        assert secret_box.is_available() is False

    assert "this-is-not-a-fernet-key" not in caplog.text


def test_a_key_of_the_wrong_length_is_not_available(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "totp_encryption_key", base64.urlsafe_b64encode(b"too short").decode())

    assert secret_box.is_available() is False


def test_in_development_with_no_key_the_public_development_key_works(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "app_env", "development")
    monkeypatch.setattr(settings, "totp_encryption_key", "")

    assert secret_box.is_available() is True
    assert secret_box.decrypt(secret_box.encrypt("JBSWY3DPEHPK3PXP")) == "JBSWY3DPEHPK3PXP"


def test_the_public_development_key_is_refused_outside_development(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "totp_encryption_key", secret_box.DEVELOPMENT_KEY)

    assert secret_box.is_available() is False


def test_a_real_key_set_in_development_beats_the_public_one(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "app_env", "development")
    monkeypatch.setattr(settings, "totp_encryption_key", REAL_KEY)
    stored = secret_box.encrypt("JBSWY3DPEHPK3PXP")

    assert Fernet(REAL_KEY.encode()).decrypt(stored.encode()) == b"JBSWY3DPEHPK3PXP"
