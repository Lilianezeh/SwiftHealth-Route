"""Encrypts the authenticator-app secret before it goes in the database. Requirements: FR-58, NFR-06.
Owner's answer D18 (2026-10-24); spec: specs/2026-10-23-accounts-and-facility-ownership/ (Phase 2c).

The server must read the secret to check a code, so it cannot be hashed; it is encrypted with a key that
is not in the database (`TOTP_ENCRYPTION_KEY`). The encryption is Fernet from the `cryptography` package
(authenticated, so a changed value is refused): nothing is written by hand. In development, with no key
set, a public development key is used so no set-up is needed; that key is refused in every other
environment, where a missing or bad key means `is_available()` is False and the set-up of an app answers
"not available yet" (the API itself still starts). Plain `def`: CPU only, nothing waits. Nothing here logs
a key, a secret or a stored value.
"""

import base64
import binascii
from dataclasses import dataclass

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

# Public on purpose (it is in the repository): it only makes development work with no set-up. Never accepted
# elsewhere.
DEVELOPMENT_KEY = base64.urlsafe_b64encode(b"development-only-key-not-secret!").decode()  # 32 bytes
FERNET_KEY_BYTES = 32


class SecretBoxError(Exception):
    """The stored value cannot be read: wrong key, changed, or not encrypted. The message holds no secret."""


class SecretBoxUnavailableError(Exception):
    """There is no usable key here, so nothing can be encrypted or read (the route answers 503)."""


@dataclass(frozen=True)
class KeyReport:
    """What can be said about the key without showing it: one fixed sentence, never the key or part of it."""

    status: str  # "ok", "development", "missing", "development_key_refused" or "invalid"
    usable: bool
    sentence: str


_PREFIX = "Authenticator app: TOTP_ENCRYPTION_KEY"


def describe_key() -> KeyReport:
    """Whether the key can be used now and, if not, why. Development, no key: the public development key."""
    key = settings.totp_encryption_key.strip()
    in_development = settings.app_env == "development"
    if not key:
        if in_development:
            return KeyReport(
                "development", True, "Authenticator app: using the public development key (development only)."
            )
        return KeyReport("missing", False, f"{_PREFIX} is not set, so the app set-up is not available.")
    if key == DEVELOPMENT_KEY and not in_development:
        return KeyReport(
            "development_key_refused",
            False,
            f"{_PREFIX} is the public development key, which is not allowed here, "
            "so the app set-up is not available.",
        )
    try:
        well_formed = len(base64.urlsafe_b64decode(key.encode())) == FERNET_KEY_BYTES
    except (binascii.Error, ValueError):
        well_formed = False
    if not well_formed:
        # The length is the clue (a good key has 44 characters): a lost "=" or a cut paste shows at once.
        return KeyReport(
            "invalid",
            False,
            f"{_PREFIX} is not a usable key: the value has {len(key)} characters, "
            "and a key has 44 characters "
            "(32 random bytes in URL-safe base64, ends with =), so the app set-up is not available.",
        )
    return KeyReport("ok", True, f"{_PREFIX} is set and usable.")


def _usable_key() -> bytes | None:
    """The key to use now, or None."""
    report = describe_key()
    if not report.usable:
        return None
    key = settings.totp_encryption_key.strip()
    return key.encode() if key else DEVELOPMENT_KEY.encode()


def is_available() -> bool:
    return describe_key().usable


def _fernet() -> Fernet:
    key = _usable_key()
    if key is None:
        raise SecretBoxUnavailableError("TOTP_ENCRYPTION_KEY is not set, or is not a usable key.")
    return Fernet(key)


def encrypt(secret: str) -> str:
    return _fernet().encrypt(secret.encode()).decode()


def decrypt(stored: str) -> str:
    fernet = _fernet()
    try:
        return fernet.decrypt(stored.encode()).decode()
    except (InvalidToken, ValueError):
        raise SecretBoxError("The stored value cannot be read with this key.") from None
