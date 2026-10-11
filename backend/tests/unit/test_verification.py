"""The one rule for "verification due". Requirements: FR-08, NFR-08, US-07.

A published listing that is past its re-check date is still shown, with `verification_due: true`, until the
nightly job hides it. Search results and the listing page must give the same answer, so both use
`is_verification_due` (services/verification.py), and neither writes the comparison again.
"""
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from sqlmodel.ext.asyncio.session import AsyncSession

from app.schemas.search import SearchParams
from app.services import listing_service, search_service
from app.services.listing_service import get_published_listing
from app.services.search_service import search_listings
from app.services.verification import is_verification_due
from tests.factories import add_listing

MOMENT = datetime(2026, 10, 6, 9, 0, tzinfo=timezone.utc)


def test_a_listing_is_due_after_its_check_date() -> None:
    assert is_verification_due(MOMENT - timedelta(seconds=1), MOMENT) is True
    assert is_verification_due(MOMENT - timedelta(days=30), MOMENT) is True


def test_a_listing_is_not_due_before_its_check_date_or_at_the_exact_moment() -> None:
    assert is_verification_due(MOMENT + timedelta(seconds=1), MOMENT) is False
    assert is_verification_due(MOMENT + timedelta(days=30), MOMENT) is False
    assert is_verification_due(MOMENT, MOMENT) is False  # due only once the date has passed, as before


def test_a_listing_with_no_check_date_is_not_due() -> None:
    assert is_verification_due(None, MOMENT) is False


def test_search_and_the_listing_page_both_use_the_shared_rule_and_neither_has_its_own_copy() -> None:
    for module in (search_service, listing_service):
        source = Path(module.__file__).read_text()

        assert "is_verification_due(" in source, module.__name__
        # The comparison is written once, in verification.py.
        assert "next_check_due <" not in source, module.__name__


@pytest.mark.anyio
async def test_search_and_the_listing_page_agree_about_which_listings_are_due(session: AsyncSession) -> None:
    check_dates = {
        "Overdue Place": MOMENT - timedelta(days=3),
        "Due A Second Ago Place": MOMENT - timedelta(seconds=1),
        "Due Exactly Now Place": MOMENT,
        "Due Later Place": MOMENT + timedelta(days=20),
        "No Date Place": None,
    }
    for name, check_date in check_dates.items():
        await add_listing(session, name, next_check_due=check_date)

    search_response = await search_listings(session, SearchParams(), MOMENT)
    in_search = {item.name: item.verification_due for item in search_response.items}
    on_the_page = {
        name: (await get_published_listing(session, name.lower().replace(" ", "-"), MOMENT)).verification_due
        for name in check_dates
    }

    assert in_search == on_the_page
    assert on_the_page == {
        "Overdue Place": True,
        "Due A Second Ago Place": True,
        "Due Exactly Now Place": False,
        "Due Later Place": False,
        "No Date Place": False,
    }
