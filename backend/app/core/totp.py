"""Time-based one-time passwords for an authenticator app, and the backup codes. FR-58, NFR-06.
Spec: specs/2026-10-23-accounts-and-facility-ownership/ (Phase 2c).

RFC 6238 (https://www.rfc-editor.org/rfc/rfc6238) on RFC 4226 (HOTP): HMAC-SHA1 of the 30-second step
number, "dynamic truncation", 6 digits. These are the settings every authenticator app assumes. Written
with the standard library (`hmac`, `hashlib`, `struct`, `base64`, `secrets`) and tested against the RFC's
own test values. Plain `def`, CPU only.

A code is accepted for the current step and one step either side (a phone clock that is a little off),
and a step is accepted only once: the caller keeps the last accepted step and passes it back, so a copied
code cannot be replayed. Backup codes are 10 characters, stored only as keyed hashes (a JSON list), and
each works once.
"""

import base64
import hashlib
import hmac
import json
import re
import secrets
import struct
from datetime import datetime
from urllib.parse import quote

from app.core.config import settings

STEP_SECONDS = 30
DIGITS = 6
WINDOW_STEPS = 1  # one step before and one after the current one
ISSUER = "SwiftHealth Route"
BACKUP_CODE_COUNT = 10
BACKUP_CODE_LENGTH = 10
BACKUP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0, O, 1 or I: they look alike
_SIX_DIGITS = re.compile(r"[0-9]{6}")


def new_secret() -> str:
    """A random 160-bit secret in base32 (32 characters), the form an app takes."""
    return base64.b32encode(secrets.token_bytes(20)).decode()


def code_for(secret: str, step: int) -> str:
    """The 6-digit code for a 30-second step (RFC 4226 section 5.3, dynamic truncation)."""
    key = base64.b32decode(secret, casefold=True)
    digest = hmac.new(key, struct.pack(">Q", step), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    number = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return f"{number % 10**DIGITS:0{DIGITS}d}"


def step_at(moment: datetime) -> int:
    return int(moment.timestamp()) // STEP_SECONDS


def normalise_code(typed: str) -> str:
    """What the person typed without spaces ("482 913" is how apps show it)."""
    return "".join(typed.split())


def looks_like_app_code(typed: str) -> bool:
    """Six digits (spaces ignored) is an app code; anything else is tried as a backup code."""
    return _SIX_DIGITS.fullmatch(normalise_code(typed)) is not None


def check_code(secret: str, code: str, last_step: int | None, moment: datetime) -> int | None:
    """The step the code was for, if right, in the window and newer than `last_step`; else None."""
    if _SIX_DIGITS.fullmatch(code) is None:  # exactly six ASCII digits: no spaces, no other scripts' digits
        return None
    current = step_at(moment)
    accepted: int | None = None
    for step in range(current - WINDOW_STEPS, current + WINDOW_STEPS + 1):
        # Every step is compared, in constant time, so the time taken does not say which step matched.
        if hmac.compare_digest(code_for(secret, step), code) and (last_step is None or step > last_step):
            accepted = step
    return accepted


def otpauth_uri(secret: str, account_email: str) -> str:
    """The address a QR code holds (https://github.com/google/google-authenticator/wiki/Key-Uri-Format)."""
    label = f"{quote(ISSUER)}:{quote(account_email, safe='')}"
    return (
        f"otpauth://totp/{label}?secret={secret}&issuer={quote(ISSUER)}"
        f"&algorithm=SHA1&digits={DIGITS}&period={STEP_SECONDS}"
    )


# --- backup codes ---


def new_backup_codes() -> list[str]:
    """Ten random codes, all different. Shown to the person once; only their hashes are kept."""
    codes: set[str] = set()
    while len(codes) < BACKUP_CODE_COUNT:
        codes.add("".join(secrets.choice(BACKUP_ALPHABET) for _ in range(BACKUP_CODE_LENGTH)))
    return sorted(codes, key=lambda _code: secrets.randbits(32))


def _normalise_backup(typed: str) -> str:
    return re.sub(r"[\s-]", "", typed).upper()


def _hash_backup(code: str) -> str:
    """Keyed hash (server secret, own label). The codes have 50 bits, so a plain hash would not do."""
    return hmac.new(settings.jwt_secret.encode(), f"backup-code:{code}".encode(), hashlib.sha256).hexdigest()


def hash_backup_codes(codes: list[str]) -> str:
    """The text kept in the database: a JSON list of hashes."""
    return json.dumps([_hash_backup(_normalise_backup(code)) for code in codes])


def load_hashes(stored: str | None) -> list[str]:
    return json.loads(stored) if stored else []


def use_backup_code(stored: str | None, typed: str) -> str | None:
    """The new stored text without the code that was used, or None if it is not one of the unused codes."""
    normalised = _normalise_backup(typed)
    if len(normalised) != BACKUP_CODE_LENGTH:
        return None
    wanted = _hash_backup(normalised)
    hashes = load_hashes(stored)
    found = [stored_hash for stored_hash in hashes if hmac.compare_digest(stored_hash, wanted)]
    if not found:
        return None
    hashes.remove(found[0])
    return json.dumps(hashes)
