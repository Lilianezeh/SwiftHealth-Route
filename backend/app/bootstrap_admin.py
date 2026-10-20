"""Creates the first admin of a new database. Run: docker compose exec backend python -m app.bootstrap_admin
Requirements: FR-41, FR-30, NFR-06. Task 4b of specs/2026-10-20-launch-readiness/.

A new production database has no users (the demo step makes listings only), so nobody could log
in or add staff. This command reads BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL,
BOOTSTRAP_ADMIN_PHONE and BOOTSTRAP_ADMIN_PASSWORD from the environment (never from arguments:
they would show in the process list and the shell history), creates one active admin, and writes
an audit entry. It refuses an email that already exists (it never overwrites a user) and never
prints or logs the password. The phone must be a real number you can receive the login code on:
the code is sent by SMS (FR-30).
"""

import asyncio
import os
from collections.abc import Mapping
from dataclasses import dataclass

from sqlmodel.ext.asyncio.session import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.database import engine, session_factory
from app.core.phone import normalise_nigerian_phone
from app.core.security import hash_password
from app.models.base import Role
from app.repositories import audit_repository, user_repository
from app.schemas.admin_user import MIN_PASSWORD_LENGTH, check_email

VARIABLES = (
    "BOOTSTRAP_ADMIN_NAME",
    "BOOTSTRAP_ADMIN_EMAIL",
    "BOOTSTRAP_ADMIN_PHONE",
    "BOOTSTRAP_ADMIN_PASSWORD",
)


class BootstrapError(Exception):
    """The command cannot run. The message names a variable, never a value of the password."""


@dataclass(frozen=True)
class AdminDetails:
    name: str
    email: str
    phone: str
    password: str


def read_details(environment: Mapping[str, str]) -> AdminDetails:
    """Reads and checks the four variables. Raises BootstrapError naming the first problem."""
    values = {}
    for variable in VARIABLES:
        value = environment.get(variable, "")
        if not value.strip():
            raise BootstrapError(f"Set {variable} in the environment.")
        values[variable] = value
    try:
        email = check_email(values["BOOTSTRAP_ADMIN_EMAIL"])
    except ValueError:
        raise BootstrapError("BOOTSTRAP_ADMIN_EMAIL is not an email address.") from None
    phone = normalise_nigerian_phone(values["BOOTSTRAP_ADMIN_PHONE"])
    if phone is None:
        raise BootstrapError("BOOTSTRAP_ADMIN_PHONE must be a Nigerian phone number that can receive SMS.")
    password = values["BOOTSTRAP_ADMIN_PASSWORD"]
    if len(password) < MIN_PASSWORD_LENGTH:
        raise BootstrapError(f"BOOTSTRAP_ADMIN_PASSWORD needs at least {MIN_PASSWORD_LENGTH} characters.")
    return AdminDetails(
        name=values["BOOTSTRAP_ADMIN_NAME"].strip(), email=email, phone=phone, password=password
    )


async def create_first_admin(session: AsyncSession, details: AdminDetails) -> str:
    """Creates the admin and returns the email. Raises BootstrapError if the email is already a user."""
    if await user_repository.get_by_email(session, details.email) is not None:
        raise BootstrapError("A user with this email already exists. Nothing was changed.")
    # run_in_threadpool (Starlette): Argon2 is slow CPU work, so it runs in a thread, off the event loop.
    password_hash = await run_in_threadpool(hash_password, details.password)
    user = await user_repository.create(
        session,
        name=details.name,
        email=details.email,
        phone=details.phone,
        password_hash=password_hash,
        role=Role.admin,
    )
    await audit_repository.add_entry(
        session,
        user_id=user.id,
        listing_id=None,
        action="user_create",
        field_changed="user",
        new_value=f"{details.email} (admin)",
        reference="bootstrap-admin",
    )
    await session.commit()
    return details.email


async def main() -> None:
    try:
        details = read_details(os.environ)
        async with session_factory() as session:
            email = await create_first_admin(session, details)
    except BootstrapError as error:
        raise SystemExit(f"Not done. {error}") from error
    finally:
        await engine.dispose()  # asyncio.run closes the event loop, so close the connections first
    print(f"Admin created: {email}. Log in at /admin/login; the code is sent by SMS to the phone you gave.")


if __name__ == "__main__":
    asyncio.run(main())
