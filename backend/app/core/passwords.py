"""The one password rule. Requirements: FR-56, NFR-06.
Spec: specs/2026-10-23-accounts-and-facility-ownership/.

Owner's rule (2026-10-24): a provider needs at least 8 characters, a verifier, editor or admin needs at
least 10 (staff and admin are not weakened), everyone at most 128, and nobody may use a very common
password or their own email. Every way an account gets a password (admin creates, admin sets, the
first-admin command, and later sign-up, change and reset) calls `check_password`, so this is the only
place that knows the rule. Plain `def`: it only compares values in memory (CLAUDE.md, async rule).

The list of common passwords is `common_passwords.txt` next to this file (source and licence at its
top). A password is compared in lower case, so "Password" and "PASSWORD" are refused too. An error
message never holds the password.
"""

from functools import cache
from pathlib import Path

from app.models.base import Role

MIN_LENGTH_PROVIDER = 8
MIN_LENGTH_STAFF = 10  # verifier, editor and admin
MAX_LENGTH = 128
COMMON_PASSWORDS_FILE = Path(__file__).with_name("common_passwords.txt")


class PasswordRuleError(ValueError):
    """The password does not meet the rule. The message is a sentence to show; it never holds the password."""


def min_length_for(role: Role) -> int:
    return MIN_LENGTH_PROVIDER if role == Role.provider else MIN_LENGTH_STAFF


@cache
def _common_passwords() -> frozenset[str]:
    lines = COMMON_PASSWORDS_FILE.read_text(encoding="utf-8").splitlines()
    return frozenset(line for line in lines if line and not line.startswith("#"))


def check_password(password: str, role: Role, email: str | None = None) -> None:
    """Returns quietly when the password is allowed for this role, otherwise raises PasswordRuleError."""
    if len(password) > MAX_LENGTH:
        raise PasswordRuleError(f"The password can be at most {MAX_LENGTH} characters.")
    if password.lower() in _common_passwords():  # first, so a short common password is called common
        raise PasswordRuleError("This password is too common. Choose another one.")
    if email is not None and password.lower() == email.strip().lower():
        raise PasswordRuleError("The password cannot be the same as the email.")
    minimum = min_length_for(role)
    if len(password) < minimum:
        raise PasswordRuleError(f"The password needs at least {minimum} characters.")
