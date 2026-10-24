"""The one-time start-up step that clears the authenticator app of one account.
Requirements: FR-58, NFR-06, NFR-07. Spec: specs/2026-10-23-accounts-and-facility-ownership/ (Phase 2c).

For the ONLY admin who has lost the phone and the backup codes (another admin would use the admin screen).
The owner sets the variable RESET_TWO_FACTOR_FOR_EMAIL in the Render dashboard to that account's email, the
API starts once, and the owner deletes the variable again. Run by backend/Dockerfile before the API:
`python -m app.reset_two_factor --at-startup`.

It does nothing, and logs nothing, when the variable is missing or blank. It never raises (a problem here
must not keep the API from starting) and logs only fixed sentences: never the email, a secret, a code or
the text of a database error.
"""

import asyncio
import logging
import os
import sys
from collections.abc import Callable, Mapping

from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import engine, session_factory
from app.models.base import utcnow
from app.services import two_factor_service

logger = logging.getLogger(__name__)  # "app.reset_two_factor"

VARIABLE = "RESET_TWO_FACTOR_FOR_EMAIL"


async def run_at_startup(
    environment: Mapping[str, str] = os.environ,
    factory: Callable[[], AsyncSession] = session_factory,
) -> None:
    email = environment.get(VARIABLE, "").strip()
    if not email:
        return  # not asked for: stay quiet
    try:
        async with factory() as session:
            found = await two_factor_service.reset_by_email(session, email, utcnow())
    except Exception as error:
        logger.error(
            "two-factor reset step failed (%s). The API will start without it.", type(error).__name__
        )
        return
    if found:
        logger.info("two-factor reset for an account")
    else:
        logger.warning("two-factor reset: no account has the email in %s", VARIABLE)


async def main_at_startup() -> None:
    try:
        await run_at_startup()
    finally:
        await engine.dispose()  # asyncio.run closes the event loop, so close the connections first


if __name__ == "__main__":
    if sys.argv[1:] == ["--at-startup"]:
        logging.basicConfig(level=logging.INFO, format="%(message)s")
        asyncio.run(main_at_startup())
    else:
        raise SystemExit("Usage: python -m app.reset_two_factor --at-startup")
