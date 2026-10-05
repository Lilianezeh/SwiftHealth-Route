"""Security helpers: password hashing and JWT tokens. See specs/backend/api-spec.md section 4.

TODO: verify_password, create_access_token, decode_access_token,
create_challenge_token (login code), decode_challenge_token.
"""
from passlib.context import CryptContext

_password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    """Returns a salted bcrypt hash. The plain password is never stored (NFR-06)."""
    return _password_context.hash(plain_password)
