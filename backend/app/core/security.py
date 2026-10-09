"""Security helpers: password hashing and JWT tokens. See specs/backend/api-spec.md section 4.

Two token types, told apart by the "purpose" claim so one can never be used as the other:
- access token: identifies the user (no role; the role is read from the database on each request).
- challenge token: proves the password step passed and carries a keyed hash of the SMS code (FR-30).
PyJWT requires the "sub" claim to be a string, so the user id is stored as str and converted back to int.
"""
import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import jwt
from pwdlib import PasswordHash
from pwdlib.exceptions import UnknownHashError

from app.core.config import settings

JWT_ALGORITHM = "HS256"
CHALLENGE_TOKEN_LIFETIME = timedelta(minutes=5)
ACCESS_PURPOSE = "access"
CHALLENGE_PURPOSE = "login_challenge"

# Argon2id with the pwdlib defaults (FastAPI docs, OAuth2 with Password and JWT).
_password_hasher = PasswordHash.recommended()


class InvalidTokenError(Exception):
    """The token is malformed, tampered with, expired or of the wrong type."""


@dataclass(frozen=True)
class ChallengeClaims:
    user_id: int
    code_hash: str


def hash_password(plain_password: str) -> str:
    """Returns a salted Argon2 hash. The plain password is never stored (NFR-06)."""
    return _password_hasher.hash(plain_password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        return _password_hasher.verify(plain_password, password_hash)
    except UnknownHashError:
        # A hash in another format (for example an old bcrypt hash) counts as a wrong password, not an error.
        return False


def generate_login_code() -> str:
    """A random 6-digit code. Leading zeros are kept ("004821")."""
    return f"{secrets.randbelow(10**6):06d}"


def hash_login_code(user_id: int, code: str) -> str:
    """Keyed hash of the code. The key is the server secret, so a client holding the challenge
    token cannot brute-force the 10^6 possible codes offline."""
    message = f"{user_id}:{code}".encode()
    return hmac.new(settings.jwt_secret.encode(), message, hashlib.sha256).hexdigest()


def code_matches(user_id: int, code: str, code_hash: str) -> bool:
    return hmac.compare_digest(hash_login_code(user_id, code), code_hash)


def hash_reporter_key(phone_or_ip: str) -> str:
    """Keyed hash that lets FR-22 count different reporters without storing a phone number or an IP (NFR-07).

    Pass the phone already as +234..., or the client IP. The key is its own secret (not jwt_secret),
    so rotating the JWT secret cannot break the counting. The fixed "reporter:" label keeps this hash apart
    from the other HMACs in this file. A plain hash would not do: every Nigerian phone number can be tried."""
    message = f"reporter:{phone_or_ip}".encode()
    return hmac.new(settings.reporter_key_secret.encode(), message, hashlib.sha256).hexdigest()


def _encode(claims: dict, lifetime: timedelta) -> str:
    expires_at = datetime.now(timezone.utc) + lifetime
    return jwt.encode({**claims, "exp": expires_at}, settings.jwt_secret, algorithm=JWT_ALGORITHM)


def _decode(token: str, expected_purpose: str) -> dict:
    try:
        claims = jwt.decode(
            token, settings.jwt_secret, algorithms=[JWT_ALGORITHM],
            options={"require": ["exp", "sub", "purpose"]},
        )
    except jwt.PyJWTError as error:
        raise InvalidTokenError("Invalid or expired token") from error
    if claims["purpose"] != expected_purpose:
        raise InvalidTokenError("Wrong token type")
    return claims


def _user_id_from(claims: dict) -> int:
    try:
        return int(claims["sub"])
    except ValueError as error:
        raise InvalidTokenError("Invalid token subject") from error


def create_access_token(user_id: int) -> str:
    return _encode(
        {"sub": str(user_id), "purpose": ACCESS_PURPOSE}, timedelta(minutes=settings.jwt_minutes)
    )


def decode_access_token(token: str) -> int:
    """Returns the user id. Raises InvalidTokenError for any bad token."""
    return _user_id_from(_decode(token, ACCESS_PURPOSE))


def create_challenge_token(
    user_id: int, code: str, expires_delta: timedelta = CHALLENGE_TOKEN_LIFETIME
) -> str:
    return _encode(
        {"sub": str(user_id), "purpose": CHALLENGE_PURPOSE, "code_hash": hash_login_code(user_id, code)},
        expires_delta,
    )


def decode_challenge_token(token: str) -> ChallengeClaims:
    claims = _decode(token, CHALLENGE_PURPOSE)
    if "code_hash" not in claims:
        raise InvalidTokenError("Challenge token has no code")
    return ChallengeClaims(user_id=_user_id_from(claims), code_hash=claims["code_hash"])
