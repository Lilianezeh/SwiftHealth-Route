"""The nightly re-check job. Run: docker compose exec backend python -m app.jobs.recheck
Requirements: FR-33, FR-36, FR-38, US-11.
Decisions H4 and H5 in specs/2026-10-20-reports-queue/requirements.md.

Moves every published listing that is past its check date to `recheck_due` (hidden from the public until a
person re-checks it), then emails the editors and admins the names. Safe to run again: the second run finds
nothing to move. No schedule is set up here: run it nightly at about 01:00 Lagos time from a scheduler you
choose (a Render Cron Job is a paid service). It uses no HTTP and prints one line.
"""

import asyncio
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import engine, session_factory
from app.services import recheck_service, staff_alert_service


async def run_on(session: AsyncSession, moment: datetime) -> list[str]:
    """Moves the overdue listings and tells the staff. Returns the names moved."""
    names = await recheck_service.move_overdue_to_recheck(session, moment)
    if names:
        summary = await staff_alert_service.load_recheck_summary(session, names)
        await staff_alert_service.send_recheck_summary(summary)
    return names


async def run_job(factory: async_sessionmaker[AsyncSession], moment: datetime) -> None:
    async with factory() as session:
        names = await run_on(session, moment)
    noun = "listing" if len(names) == 1 else "listings"
    print(f"{len(names)} {noun} moved to re-check due.")


async def main() -> None:
    try:
        await run_job(session_factory, datetime.now(timezone.utc))
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
