"""The one password rule. Requirements: FR-56, NFR-06.
Spec: specs/2026-10-23-accounts-and-facility-ownership/.

Owner's rule (2026-10-24): a provider needs 8 to 128 characters, a verifier, editor or admin needs 10 to
128, and nobody may use a very common password or their own email. The staff and admin minimum is not
weakened.
"""

import re
from pathlib import Path

import pytest

from app.core import passwords
from app.core.passwords import PasswordRuleError, check_password, min_length_for
from app.models.base import Role

STAFF_ROLES = [Role.verifier, Role.editor, Role.admin]
APP_FOLDER = Path(passwords.__file__).resolve().parent.parent


def test_a_provider_needs_8_characters_and_staff_and_admin_need_10() -> None:
    assert min_length_for(Role.provider) == 8
    for role in STAFF_ROLES:
        assert min_length_for(role) == 10


def test_a_provider_password_of_7_is_refused_and_of_8_is_accepted() -> None:
    with pytest.raises(PasswordRuleError, match="at least 8 characters"):
        check_password("river7!", Role.provider, "ada@example.com")
    check_password("river78!", Role.provider, "ada@example.com")


@pytest.mark.parametrize("role", STAFF_ROLES)
def test_a_staff_or_admin_password_of_9_is_refused_and_of_10_is_accepted(role: Role) -> None:
    with pytest.raises(PasswordRuleError, match="at least 10 characters"):
        check_password("river-b9!", role, "ada@example.com")
    check_password("river-bed!", role, "ada@example.com")


@pytest.mark.parametrize("role", [Role.provider, *STAFF_ROLES])
def test_128_characters_are_accepted_and_129_are_refused_for_everyone(role: Role) -> None:
    check_password("k" * 63 + "-" + "q" * 64, role, "ada@example.com")
    with pytest.raises(PasswordRuleError, match="at most 128"):
        check_password("k" * 129, role, "ada@example.com")


@pytest.mark.parametrize("role", [Role.provider, *STAFF_ROLES])
@pytest.mark.parametrize(
    "password",
    ["password", "12345678", "qwertyuiop", "iloveyou", "Password", "PASSWORD", "PassWord", "1234567890"],
)
def test_a_very_common_password_is_refused_for_every_role_in_any_case(role: Role, password: str) -> None:
    with pytest.raises(PasswordRuleError, match="too common"):
        check_password(password, role, "ada@example.com")


def test_the_email_is_refused_as_a_password_in_any_case() -> None:
    with pytest.raises(PasswordRuleError, match="email"):
        check_password("Ada.Verifier@Example.com", Role.editor, "ada.verifier@example.com")


def test_the_email_is_not_needed_when_it_is_not_known() -> None:
    check_password("river-bed-77", Role.editor)


def test_the_list_is_a_plain_text_file_with_its_source_and_licence_and_no_entry_below_8_characters() -> None:
    lines = (APP_FOLDER / "core" / "common_passwords.txt").read_text(encoding="utf-8").splitlines()
    comments = [line for line in lines if line.startswith("#")]
    entries = [line for line in lines if line and not line.startswith("#")]
    assert any("SecLists" in line for line in comments) and any("MIT" in line for line in comments)
    assert len(entries) > 1000
    assert all(len(entry) >= 8 and entry == entry.lower() for entry in entries)
    assert len(entries) == len(set(entries))


def test_a_message_never_holds_the_password() -> None:
    for password, role in [("Zq9!", Role.provider), ("qwertyuiop", Role.admin), ("Zq9!" * 40, Role.editor)]:
        with pytest.raises(PasswordRuleError) as error:
            check_password(password, role, "ada@example.com")
        assert password not in str(error.value)


def test_only_passwords_py_knows_the_lengths_and_the_rule() -> None:
    """The old constant is gone from the schema and the bootstrap command: they call check_password."""
    for relative in ("schemas/admin_user.py", "bootstrap_admin.py", "services/admin_user_service.py"):
        source = (APP_FOLDER / relative).read_text(encoding="utf-8")
        assert not re.search(r"MIN_PASSWORD_LENGTH\s*=", source), relative
        assert "min_length=MIN_PASSWORD" not in source, relative
