"""The nightly owner-fee job. Run: docker compose exec backend python -m app.jobs.owner_fee
Requirements: FR-50, FR-46, NFR-07. Spec: specs/2026-10-29-owner-fee/.

Lapses links whose paid month and grace days ended, removes cancelled links whose paid month
ended, emails the reminders (7, 3 and 1 days before the month ends) and asks Paystack again for
refunds it did not accept. Safe to run again: a second run the same night finds nothing to do.
Run it once a night (GitHub Actions does, .github/workflows/nightly-jobs.yml). It uses no HTTP and
prints one line of counts: no name, no address.
"""

import asyncio
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import engine, session_factory
from app.services import owner_fee_upkeep_service
from app.services.owner_fee_upkeep_service import UpkeepResult


async def run_on(session: AsyncSession, moment: datetime) -> UpkeepResult:
    return await owner_fee_upkeep_service.run_all(session, moment)


async def run_job(factory: async_sessionmaker[AsyncSession], moment: datetime) -> None:
    async with factory() as session:
        result = await run_on(session, moment)
    print(
        f"{result.lapsed} lapsed, {result.ended} ended, {result.reminders} reminders sent, "
        f"{result.refunds_done} refunds done."
    )


async def main() -> None:
    try:
        await run_job(session_factory, datetime.now(timezone.utc))
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
