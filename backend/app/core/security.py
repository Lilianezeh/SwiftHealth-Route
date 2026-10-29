"""Security helpers: password hashing and JWT tokens. See specs/backend/api-spec.md section 4.

Token types, told apart by the "purpose" claim so one can never be used as another:
- access token: identifies the user (no role; the role is read from the database on each request).
- code tokens: carry a keyed hash of a code that was sent, and nothing else. The login challenge
  (FR-30, the SMS code after the password step) is one; the email, phone and password-reset codes
  (FR-48, FR-54) are the others.
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
from app.models.base import Role

JWT_ALGORITHM = "HS256"
CHALLENGE_TOKEN_LIFETIME = timedelta(minutes=5)
ACCESS_PURPOSE = "access"
CHALLENGE_PURPOSE = "login_challenge"
# The codes of sign-up and of a forgotten password (FR-48, FR-54, accounts spec).
EMAIL_CONFIRM_PURPOSE = "email_confirm"
PHONE_CONFIRM_PURPOSE = "phone_confirm"
PASSWORD_RESET_PURPOSE = "password_reset"
EMAIL_CHANGE_PURPOSE = "email_change"  # a code sent to the NEW email of a logged-in person (FR-54)
PHONE_CHANGE_PURPOSE = "phone_change"  # a code texted to the NEW phone of a logged-in person (FR-54)
TOTP_CHALLENGE_PURPOSE = "login_totp"  # password step passed; the second step is a code from the app (FR-58)
LOGIN_CODE_PURPOSE = "login_code"  # the text of the login code sent by email when there is no SMS (D19)
EMAIL_CODE_LIFETIME = timedelta(minutes=15)
PHONE_CODE_LIFETIME = timedelta(minutes=5)  # an SMS is read at once, and it costs money to resend
PASSWORD_RESET_LIFETIME = timedelta(minutes=15)

# Argon2id with the pwdlib defaults (FastAPI docs, OAuth2 with Password and JWT).
_password_hasher = PasswordHash.recommended()


class InvalidTokenError(Exception):
    """The token is malformed, tampered with, expired or of the wrong type."""


@dataclass(frozen=True)
class ChallengeClaims:
    user_id: int
    code_hash: str
    sent_at: datetime  # when the code was sent (whole seconds, UTC)
    new_value: str | None = None  # a new email or phone the code is for (FR-54); None for the others


@dataclass(frozen=True)
class AccessClaims:
    user_id: int
    issued_ms: int | None  # when the token was made (ms); None for a token made before this claim existed
    expires_at: datetime  # when the token stops working: the idle limit after the last renewal
    # When the whole session began (ms), kept by every renewal; None for an older token.
    session_started_ms: int | None = None


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


def idle_limit_for(role: Role) -> timedelta:
    """How long an account may be idle before it is signed out: admin 5 minutes, any other role 15.

    Both numbers are settings (IDLE_MINUTES_ADMIN, IDLE_MINUTES_OTHER)."""
    minutes = settings.idle_minutes_admin if role == Role.admin else settings.idle_minutes_other
    return timedelta(minutes=minutes)


def create_access_token(user_id: int, role: Role, session_started_ms: int | None = None) -> str:
    """The login token. It lives as long as the idle limit of the role (`idle_limit_for`).

    The browser asks for a new one while the person is active (POST /auth/keep-alive), so a
    session nobody uses expires on its own. The role only chooses that length; it is not in the
    token, and the API still reads the role from the database on every request.
    `ims` is the moment it was made, in milliseconds: a token made before the account's last
    password change is refused (decision D10). Our own claim, not the standard `iat`, which has
    whole seconds only. `sts` is when the whole session began: a renewal passes it on
    (`session_started_ms`), so a session ends after `jwt_minutes` however active the person is."""
    issued_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    return _encode(
        {
            "sub": str(user_id), "purpose": ACCESS_PURPOSE, "ims": issued_ms,
            "sts": session_started_ms if session_started_ms is not None else issued_ms,
        },
        idle_limit_for(role),
    )


def decode_access_claims(token: str) -> AccessClaims:
    """The user id, when the token was made and when the session began.

    Raises InvalidTokenError for any bad token."""
    claims = _decode(token, ACCESS_PURPOSE)
    issued = claims.get("ims")
    started = claims.get("sts")
    return AccessClaims(
        user_id=_user_id_from(claims),
        issued_ms=issued if isinstance(issued, int) else None,
        expires_at=datetime.fromtimestamp(claims["exp"], tz=timezone.utc),
        session_started_ms=started if isinstance(started, int) else None,
    )


def decode_access_token(token: str) -> int:
    """Returns the user id. Raises InvalidTokenError for any bad token."""
    return decode_access_claims(token).user_id


def create_code_token(
    user_id: int,
    code: str,
    purpose: str,
    expires_delta: timedelta,
    sent_at: datetime | None = None,
    new_value: str | None = None,
) -> str:
    """A signed token that proves a code was sent to a user, without storing the code (a keyed hash is in it).

    The `purpose` (login, email, phone, password reset) is in the signed claims, so a token made for
    one use is refused for another. `sent_at` (now, if not given) is our own claim, not the standard `iat`,
    so the rule "at least 60 seconds between two codes" (FR-57) can read it, and a test clock or a skewed
    server clock cannot make the token invalid.
    """
    sent = sent_at or datetime.now(timezone.utc)
    claims = {
        "sub": str(user_id),
        "purpose": purpose,
        "code_hash": hash_login_code(user_id, code),
        "sent_at": int(sent.timestamp()),
    }
    if new_value is not None:
        claims["new"] = new_value  # the new email or phone: signed, so it cannot be swapped for another
    return _encode(claims, expires_delta)


def decode_code_token(token: str, purpose: str) -> ChallengeClaims:
    """Returns the user id, the code hash and the send time. Raises InvalidTokenError for a bad token.

    A token made before `sent_at` existed (at most 5 minutes old at the deploy) counts as sent long ago.
    """
    claims = _decode(token, purpose)
    if "code_hash" not in claims:
        raise InvalidTokenError("Token has no code")
    sent_at = datetime.fromtimestamp(int(claims.get("sent_at", 0)), tz=timezone.utc)
    new_value = claims.get("new")
    return ChallengeClaims(
        user_id=_user_id_from(claims),
        code_hash=claims["code_hash"],
        sent_at=sent_at,
        new_value=new_value if isinstance(new_value, str) else None,
    )


def create_challenge_token(
    user_id: int,
    code: str,
    expires_delta: timedelta = CHALLENGE_TOKEN_LIFETIME,
    sent_at: datetime | None = None,
) -> str:
    return create_code_token(user_id, code, CHALLENGE_PURPOSE, expires_delta, sent_at)


def decode_challenge_token(token: str) -> ChallengeClaims:
    return decode_code_token(token, CHALLENGE_PURPOSE)


def create_totp_challenge_token(user_id: int, expires_delta: timedelta = CHALLENGE_TOKEN_LIFETIME) -> str:
    """Proves the password step passed for a person with the authenticator app: no code is in it (FR-58)."""
    return _encode({"sub": str(user_id), "purpose": TOTP_CHALLENGE_PURPOSE}, expires_delta)


def decode_totp_challenge_token(token: str) -> int:
    """Returns the user id. Raises InvalidTokenError for any bad token, and for a code challenge."""
    return _user_id_from(_decode(token, TOTP_CHALLENGE_PURPOSE))
