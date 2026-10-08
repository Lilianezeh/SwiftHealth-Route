"""Seed fictional Enugu demo data. Run: docker compose exec backend python -m seed.seed

Safe to run more than once: anything that already exists (matched by category slug, user email or
listing slug) is skipped and never overwritten, so changed passwords and staff edits are kept.
Passwords come from the environment (SEED_*_PASSWORD), never from this file.
The data itself is in seed/seed_data.py. Demo data must stay clearly fictional.
"""
import asyncio
import os
from collections.abc import Mapping
from datetime import datetime, timedelta

from sqlmodel.ext.asyncio.session import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.database import engine, session_factory
from app.core.security import hash_password
from app.models import Category, Listing, OpeningHours, PhoneNumber, Service, User
from app.models.base import CheckMethod, CheckResult, Role, utcnow
from app.repositories import audit_repository, category_repository, listing_repository, user_repository
from seed.seed_data import CATEGORIES, LISTINGS, USERS, ListingSeed

MINIMUM_PASSWORD_LENGTH = 10  # same minimum as the admin API (api-spec section 11)
PASSWORD_VARIABLES = {
    Role.verifier: "SEED_VERIFIER_PASSWORD",
    Role.editor: "SEED_EDITOR_PASSWORD",
    Role.admin: "SEED_ADMIN_PASSWORD",
    Role.provider: "SEED_PROVIDER_PASSWORD",
}


class SeedConfigError(Exception):
    """The seed cannot run because its configuration is incomplete."""


def read_passwords(environment: Mapping[str, str]) -> dict[Role, str]:
    """Reads one password per role. Names every problem variable, never prints a value."""
    passwords: dict[Role, str] = {}
    problem_variables: list[str] = []
    for role, variable in PASSWORD_VARIABLES.items():
        password = environment.get(variable, "")
        if len(password) < MINIMUM_PASSWORD_LENGTH:
            problem_variables.append(variable)
        else:
            passwords[role] = password
    if problem_variables:
        raise SeedConfigError(
            f"Set these in your .env (at least {MINIMUM_PASSWORD_LENGTH} characters each): "
            + ", ".join(problem_variables)
        )
    return passwords


async def run(
    session: AsyncSession, passwords: Mapping[Role, str], now: datetime | None = None
) -> dict[str, int]:
    """Creates whatever is missing and returns how many categories, users and listings were created."""
    now = now or utcnow()
    created = {"categories": 0, "users": 0, "listings": 0}

    categories = {}
    for category_seed in CATEGORIES:
        category = await category_repository.get_by_slug(session, category_seed.slug)
        if category is None:
            category = await category_repository.create(
                session, name=category_seed.name, slug=category_seed.slug,
                is_emergency=category_seed.is_emergency, recheck_days=category_seed.recheck_days,
            )
            created["categories"] += 1
        categories[category_seed.slug] = category

    users = {}
    for user_seed in USERS:
        user = await user_repository.get_by_email(session, user_seed.email)
        if user is None:
            # run_in_threadpool (Starlette): Argon2 is slow CPU work, so it runs in a thread, off the loop.
            password_hash = await run_in_threadpool(hash_password, passwords[user_seed.role])
            user = await user_repository.create(
                session, name=user_seed.name, email=user_seed.email, phone=user_seed.phone,
                password_hash=password_hash, role=user_seed.role,
            )
            created["users"] += 1
        users[user_seed.role] = user

    for listing_seed in LISTINGS:
        if await listing_repository.get_by_slug(session, listing_seed.slug) is not None:
            continue  # already seeded: skip the listing and all of its phones, hours and services
        await add_demo_listing(session, listing_seed, categories[listing_seed.category_slug], users, now)
        created["listings"] += 1

    await session.commit()
    return created


async def add_demo_listing(
    session: AsyncSession,
    listing_seed: ListingSeed,
    category: Category,
    users: Mapping[Role, User],
    now: datetime,
) -> None:
    """Adds one listing with its phones, hours, services, check history and audit entry."""
    verifier = users[Role.verifier]
    last_verified_at = None
    next_check_due = None
    if listing_seed.verified_days_ago is not None:
        last_verified_at = now - timedelta(days=listing_seed.verified_days_ago)
        next_check_due = last_verified_at + timedelta(days=category.recheck_days)  # FR-33

    listing = Listing(
        slug=listing_seed.slug, name=listing_seed.name, category_id=category.id, area=listing_seed.area,
        address=listing_seed.address, landmark=listing_seed.landmark,
        latitude=listing_seed.latitude, longitude=listing_seed.longitude,
        description=listing_seed.description, status=listing_seed.status,
        is_24_hours=listing_seed.is_24_hours,
        owner_id=users[Role.provider].id if listing_seed.owned_by_provider else None,
        created_by=verifier.id, last_verified_at=last_verified_at, next_check_due=next_check_due,
    )
    phones = [
        PhoneNumber(number=phone.number, label=phone.label, is_primary=phone.is_primary,
                    last_working_at=last_verified_at)
        for phone in listing_seed.phones
    ]
    opening_hours = [
        OpeningHours(day_of_week=hours.day_of_week, opens_at=hours.opens_at, closes_at=hours.closes_at,
                     is_closed=hours.is_closed)
        for hours in listing_seed.opening_hours
    ]
    services = [
        Service(name=service.name, fee_min_naira=service.fee_min_naira, fee_max_naira=service.fee_max_naira,
                fee_collected_at=service.collected_at)
        for service in listing_seed.services
    ]
    await listing_repository.add_listing_with_details(session, listing, phones, opening_hours, services)

    if last_verified_at is not None:  # published listings carry a passing call and visit (publish rule)
        for method, checked_at in ((CheckMethod.call, last_verified_at - timedelta(days=1)),
                                   (CheckMethod.visit, last_verified_at)):
            await listing_repository.add_verification_check(
                session, listing_id=listing.id, staff_id=verifier.id, method=method,
                result=CheckResult.passed, person_reached="Demo contact", notes="Demo data (fictional)",
                checked_at=checked_at,
            )

    await audit_repository.add_entry(
        session, user_id=verifier.id, listing_id=listing.id, action="create", reference="seed",
    )


async def main() -> None:
    try:
        passwords = read_passwords(os.environ)
    except SeedConfigError as error:
        raise SystemExit(f"Seed not run. {error}") from error
    async with session_factory() as session:
        created = await run(session, passwords)
    await engine.dispose()  # asyncio.run closes the event loop, so close the connections first
    print(f"Seed complete. Created: {created}")


if __name__ == "__main__":
    asyncio.run(main())
