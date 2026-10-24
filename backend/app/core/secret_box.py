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


def _usable_key() -> bytes | None:
    """The key to use now, or None. Development with no key: the public development key."""
    key = settings.totp_encryption_key.strip()
    in_development = settings.app_env == "development"
    if not key:
        return DEVELOPMENT_KEY.encode() if in_development else None
    if key == DEVELOPMENT_KEY and not in_development:
        return None
    try:
        if len(base64.urlsafe_b64decode(key.encode())) != FERNET_KEY_BYTES:
            return None
    except (binascii.Error, ValueError):
        return None
    return key.encode()


def is_available() -> bool:
    return _usable_key() is not None


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
