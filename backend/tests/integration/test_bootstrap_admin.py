"""The command that creates the first admin of a new database. Requirements: FR-41, FR-30, NFR-06.
Without it a production database has no staff and nobody could log in or add staff
(specs/2026-10-20-launch-readiness/, task 4b). It reads the details from the environment (never from
arguments, so a password is not in the process list or the shell history), refuses to overwrite an
existing user, and never prints the password.
"""

import pytest
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.bootstrap_admin import BootstrapError, create_first_admin, read_details
from app.core.security import verify_password
from app.models import AuditEntry, User
from app.models.base import Role

pytestmark = pytest.mark.anyio

GOOD = {
    "BOOTSTRAP_ADMIN_NAME": "First Admin",
    "BOOTSTRAP_ADMIN_EMAIL": "First.Admin@Example.com",
    "BOOTSTRAP_ADMIN_PHONE": "0803 000 0000",
    "BOOTSTRAP_ADMIN_PASSWORD": "a-long-enough-password",
}


async def test_it_creates_an_active_admin_with_a_hashed_password_and_an_audit_entry(
    session: AsyncSession,
) -> None:
    details = read_details(GOOD)

    email = await create_first_admin(session, details)

    assert email == "first.admin@example.com"
    [user] = (await session.exec(select(User))).all()
    assert (user.name, user.email, user.phone, user.role, user.is_active) == (
        "First Admin",
        "first.admin@example.com",
        "+2348030000000",
        Role.admin,
        True,
    )
    assert user.password_hash != GOOD["BOOTSTRAP_ADMIN_PASSWORD"]
    assert verify_password(GOOD["BOOTSTRAP_ADMIN_PASSWORD"], user.password_hash)
    [entry] = (await session.exec(select(AuditEntry))).all()
    assert (entry.action, entry.reference) == ("user_create", "bootstrap-admin")
    assert GOOD["BOOTSTRAP_ADMIN_PASSWORD"] not in " ".join(str(v) for v in entry.model_dump().values())


async def test_it_refuses_an_email_that_is_already_a_user_and_changes_nothing(session: AsyncSession) -> None:
    await create_first_admin(session, read_details(GOOD))

    with pytest.raises(BootstrapError, match="already exists"):
        await create_first_admin(
            session, read_details({**GOOD, "BOOTSTRAP_ADMIN_PASSWORD": "another-long-password"})
        )

    [user] = (await session.exec(select(User))).all()
    assert verify_password(GOOD["BOOTSTRAP_ADMIN_PASSWORD"], user.password_hash)  # not overwritten


@pytest.mark.parametrize("missing", list(GOOD))
def test_every_variable_is_needed_and_the_error_names_it(missing: str) -> None:
    environment = {key: value for key, value in GOOD.items() if key != missing}

    with pytest.raises(BootstrapError, match=missing):
        read_details(environment)


@pytest.mark.parametrize(
    ("variable", "value", "message"),
    [
        ("BOOTSTRAP_ADMIN_PASSWORD", "short", "at least 10"),
        ("BOOTSTRAP_ADMIN_PHONE", "12345", "Nigerian"),
        ("BOOTSTRAP_ADMIN_EMAIL", "not-an-email", "email"),
        ("BOOTSTRAP_ADMIN_NAME", "   ", "BOOTSTRAP_ADMIN_NAME"),
    ],
)
def test_bad_values_are_refused_with_a_sentence_that_never_holds_the_password(
    variable: str, value: str, message: str
) -> None:
    with pytest.raises(BootstrapError, match=message) as error:
        read_details({**GOOD, variable: value})

    assert GOOD["BOOTSTRAP_ADMIN_PASSWORD"] not in str(error.value)
    assert value not in str(error.value) or variable == "BOOTSTRAP_ADMIN_NAME"
