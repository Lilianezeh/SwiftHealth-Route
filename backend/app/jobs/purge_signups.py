"""The nightly clean-up of sign-ups that were never finished.
Run: docker compose exec backend python -m app.jobs.purge_signups
Requirements: FR-48, NFR-07 (minimal personal data). Decision D8 in
specs/2026-10-23-accounts-and-facility-ownership/.

Deletes every account whose email or phone was not confirmed within 7 days of the sign-up and that no
other row names (an audit entry, a listing, a report or a check): such an account can do nothing, so its
name, email and phone are not kept. It is the only place an account is deleted. Safe to run again: the
second run finds nothing. No schedule is set up here: run it nightly from a scheduler you choose, like
the re-check job (`python -m app.jobs.recheck`). It uses no HTTP, logs nothing about a person and prints
one line.
"""

import asyncio
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import engine, session_factory
from app.services import signup_service


async def run_job(factory: async_sessionmaker[AsyncSession], moment: datetime) -> int:
    async with factory() as session:
        deleted = await signup_service.purge_unconfirmed(session, moment)
    noun = "account" if deleted == 1 else "accounts"
    print(f"{deleted} unfinished sign-up {noun} deleted.")
    return deleted


async def main() -> None:
    try:
        await run_job(session_factory, datetime.now(timezone.utc))
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
