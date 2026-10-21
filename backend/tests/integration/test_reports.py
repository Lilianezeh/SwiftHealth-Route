"""POST /reports through HTTP. Requirements: US-08, FR-20 to FR-22, NFR-06, NFR-07, FR-38.

The contract is specs/backend/api-spec.md, "POST /reports". The clock is replaced with a fixed moment.
Decisions B1 to B6 in specs/2026-10-20-reports/requirements.md. Staff alerts are replaced by a recorder.
"""

from collections.abc import Iterator
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment
from app.core.security import hash_reporter_key
from app.main import app
from app.models import AuditEntry, Listing, UserReport
from app.models.base import ListingStatus, ReportReason, ReportStatus
from app.services import staff_alert_service
from app.services.staff_alert_service import StaffAlert
from tests.factories import add_listing, add_report

pytestmark = pytest.mark.anyio

NOW = datetime(2026, 10, 6, 9, 0, tzinfo=timezone.utc)
FICTIONAL_PHONE = "08030000000"
PHONE_E164 = "+2348030000000"


@pytest.fixture
def clock() -> Iterator[None]:
    app.dependency_overrides[get_current_moment] = lambda: NOW
    yield
    app.dependency_overrides.pop(get_current_moment, None)


@pytest.fixture
def alerts(monkeypatch: pytest.MonkeyPatch) -> list[StaffAlert]:
    """Replaces the sending of staff alerts by a list, so no email or SMS is ever attempted."""
    sent: list[StaffAlert] = []

    async def record(alert: StaffAlert) -> None:
        sent.append(alert)

    monkeypatch.setattr(staff_alert_service, "send_alerts", record)
    return sent


async def post_report(client: AsyncClient, ip: str = "203.0.113.5", **body: object):
    return await client.post("/reports", json=body, headers={"x-forwarded-for": ip})


async def rows(session: AsyncSession, model):
    return (await session.exec(select(model))).all()


async def test_a_report_is_created_with_201_and_the_thank_you(
    client: AsyncClient, session: AsyncSession, clock: None, alerts: list
) -> None:
    listing = await add_listing(session, "Night Pharmacy")
    await session.commit()
    response = await post_report(
        client,
        listing_id=listing.id,
        reason="wrong_number",
        comment="Rang twice",
        reporter_phone=FICTIONAL_PHONE,
    )
    assert response.status_code == 201  # needs no login
    body = response.json()
    assert body["message"] == "Thank you. We will check this listing."
    [report] = await rows(session, UserReport)
    assert body["id"] == report.id
    assert report.listing_id == listing.id
    assert report.reason == ReportReason.wrong_number
    assert report.comment == "Rang twice"
    assert report.reporter_phone == PHONE_E164  # normalised (decision B2)
    assert report.status == ReportStatus.open
    assert report.created_at == NOW


async def test_comment_and_phone_are_optional_and_blank_means_none(
    client: AsyncClient, session: AsyncSession, clock: None, alerts: list
) -> None:
    listing = await add_listing(session, "Night Pharmacy")
    await session.commit()
    response = await post_report(
        client, listing_id=listing.id, reason="closed", comment="  ", reporter_phone=""
    )
    assert response.status_code == 201
    [report] = await rows(session, UserReport)
    assert report.comment is None
    assert report.reporter_phone is None


async def test_the_reporter_key_is_a_keyed_hash_of_the_phone_else_of_the_ip_never_the_raw_values(
    client: AsyncClient, session: AsyncSession, clock: None, alerts: list
) -> None:
    listing = await add_listing(session, "Night Pharmacy")
    await session.commit()
    await post_report(client, ip="203.0.113.7", listing_id=listing.id, reason="closed")
    await post_report(
        client, ip="203.0.113.8", listing_id=listing.id, reason="closed", reporter_phone=FICTIONAL_PHONE
    )
    by_ip, by_phone = await rows(session, UserReport)
    assert by_ip.reporter_key == hash_reporter_key("203.0.113.7")
    assert by_phone.reporter_key == hash_reporter_key(PHONE_E164)
    stored = " ".join(str(value) for report in (by_ip, by_phone) for value in report.model_dump().values())
    assert "203.0.113.7" not in stored and "203.0.113.8" not in stored  # NFR-07


@pytest.mark.parametrize("status", [s for s in ListingStatus if s is not ListingStatus.published])
async def test_a_report_for_an_unpublished_listing_is_404_like_an_unknown_one(
    client: AsyncClient, session: AsyncSession, clock: None, alerts: list, status: ListingStatus
) -> None:
    listing = await add_listing(session, "Hidden Place", status=status)
    await session.commit()
    unpublished = await post_report(client, listing_id=listing.id, reason="closed")
    unknown = await post_report(client, listing_id=99999, reason="closed")
    assert unpublished.status_code == unknown.status_code == 404
    assert unpublished.json() == unknown.json() == {"detail": "Listing not found"}
    assert await rows(session, UserReport) == []


@pytest.mark.parametrize(
    "body",
    [
        {"reason": "not_a_reason"},
        {"reason": "closed", "comment": "x" * 501},
        {"reason": "closed", "reporter_phone": "12345"},
        {"reason": "closed", "reporter_phone": "+14155550123"},
        {"reason": "closed", "listing_id": "abc"},
        {"listing_id": 1},
    ],
)
async def test_bad_input_is_422(
    client: AsyncClient, session: AsyncSession, clock: None, alerts: list, body: dict
) -> None:
    listing = await add_listing(session, "Night Pharmacy")
    await session.commit()
    payload = {"listing_id": listing.id, **body}
    response = await post_report(client, **payload)
    assert response.status_code == 422
    assert await rows(session, UserReport) == []


async def test_a_comment_of_exactly_500_characters_is_accepted(
    client: AsyncClient, session: AsyncSession, clock: None, alerts: list
) -> None:
    listing = await add_listing(session, "Night Pharmacy")
    await session.commit()
    response = await post_report(client, listing_id=listing.id, reason="other", comment="x" * 500)
    assert response.status_code == 201


async def test_the_first_not_working_report_flags_nothing(
    client: AsyncClient, session: AsyncSession, clock: None, alerts: list
) -> None:
    listing = await add_listing(session, "Night Pharmacy")
    await session.commit()
    await post_report(client, listing_id=listing.id, reason="not_working")
    await session.refresh(listing)
    assert listing.status == ListingStatus.published
    assert alerts == []
    assert await rows(session, AuditEntry) == []


async def test_the_second_not_working_report_from_a_different_reporter_flags_the_listing(
    client: AsyncClient, session: AsyncSession, clock: None, alerts: list
) -> None:
    listing = await add_listing(session, "Night Pharmacy")
    await session.commit()
    await post_report(client, ip="203.0.113.1", listing_id=listing.id, reason="not_working")
    await post_report(client, ip="203.0.113.2", listing_id=listing.id, reason="not_working")
    await session.refresh(listing)
    assert listing.status == ListingStatus.recheck_due  # FR-22
    assert listing.next_check_due == NOW  # decision B5
    [entry] = await rows(session, AuditEntry)
    assert (entry.user_id, entry.listing_id, entry.action) == (None, listing.id, "flag")
    assert (entry.field_changed, entry.old_value, entry.new_value) == ("status", "published", "recheck_due")
    assert entry.reference == "auto-flag"
    assert [alert.listing_name for alert in alerts] == ["Night Pharmacy"]


async def test_two_reports_from_the_same_reporter_count_once(
    client: AsyncClient, session: AsyncSession, clock: None, alerts: list
) -> None:
    listing = await add_listing(session, "Night Pharmacy")
    await session.commit()
    await post_report(client, ip="203.0.113.1", listing_id=listing.id, reason="not_working")
    await post_report(client, ip="203.0.113.1", listing_id=listing.id, reason="not_working")
    await post_report(
        client, ip="203.0.113.1", listing_id=listing.id, reason="not_working", reporter_phone=""
    )
    await session.refresh(listing)
    assert listing.status == ListingStatus.published
    assert alerts == []


async def test_the_same_phone_from_two_networks_is_one_reporter_but_two_phones_are_two(
    client: AsyncClient, session: AsyncSession, clock: None, alerts: list
) -> None:
    listing = await add_listing(session, "Night Pharmacy")
    await session.commit()
    await post_report(
        client, ip="203.0.113.1", listing_id=listing.id, reason="not_working", reporter_phone="08030000000"
    )
    await post_report(
        client, ip="203.0.113.2", listing_id=listing.id, reason="not_working", reporter_phone="+2348030000000"
    )
    await session.refresh(listing)
    assert listing.status == ListingStatus.published  # one phone, one reporter
    await post_report(
        client, ip="203.0.113.3", listing_id=listing.id, reason="not_working", reporter_phone="08030000001"
    )
    await session.refresh(listing)
    assert listing.status == ListingStatus.recheck_due


async def test_other_reasons_and_old_or_closed_reports_do_not_count_toward_the_flag(
    client: AsyncClient, session: AsyncSession, clock: None, alerts: list
) -> None:
    listing = await add_listing(session, "Night Pharmacy")
    await add_report(session, listing, "old-reporter", created_at=NOW - timedelta(days=8))  # outside 7 days
    await add_report(
        session, listing, "done-reporter", created_at=NOW - timedelta(days=1), status=ReportStatus.resolved
    )
    await session.commit()
    await post_report(client, ip="203.0.113.1", listing_id=listing.id, reason="wrong_hours")
    await post_report(client, ip="203.0.113.2", listing_id=listing.id, reason="closed")
    await post_report(client, ip="203.0.113.3", listing_id=listing.id, reason="not_working")
    await session.refresh(listing)
    assert listing.status == ListingStatus.published  # only one counting reporter


async def test_a_report_from_a_second_reporter_counts_with_a_report_made_six_days_ago(
    client: AsyncClient, session: AsyncSession, clock: None, alerts: list
) -> None:
    listing = await add_listing(session, "Night Pharmacy")
    await add_report(session, listing, "earlier-reporter", created_at=NOW - timedelta(days=6, hours=23))
    await session.commit()
    await post_report(client, ip="203.0.113.1", listing_id=listing.id, reason="not_working")
    await session.refresh(listing)
    assert listing.status == ListingStatus.recheck_due


async def test_a_flagged_listing_is_flagged_once_not_again_by_a_third_report(
    client: AsyncClient, session: AsyncSession, clock: None, alerts: list
) -> None:
    listing = await add_listing(session, "Night Pharmacy")
    await session.commit()
    for number in (1, 2):
        await post_report(client, ip=f"203.0.113.{number}", listing_id=listing.id, reason="not_working")
    third = await post_report(client, ip="203.0.113.3", listing_id=listing.id, reason="not_working")
    assert third.status_code == 404  # now recheck_due: no longer published (decision 1)
    assert len(await rows(session, AuditEntry)) == 1
    assert len(alerts) == 1


async def test_the_sixth_report_from_one_address_in_an_hour_is_429(
    client: AsyncClient, session: AsyncSession, clock: None, alerts: list
) -> None:
    listing = await add_listing(session, "Night Pharmacy")
    await session.commit()
    for _ in range(5):
        assert (await post_report(client, listing_id=listing.id, reason="other")).status_code == 201
    sixth = await post_report(client, listing_id=listing.id, reason="other")
    assert sixth.status_code == 429
    assert sixth.json() == {"detail": "You've sent several reports. Please try again later."}
    other_address = await post_report(client, ip="198.51.100.9", listing_id=listing.id, reason="other")
    assert other_address.status_code == 201


async def test_the_listing_is_not_changed_by_a_report_that_does_not_flag_it(
    client: AsyncClient, session: AsyncSession, clock: None, alerts: list
) -> None:
    listing = await add_listing(session, "Night Pharmacy", next_check_due=NOW + timedelta(days=10))
    await session.commit()
    await post_report(client, listing_id=listing.id, reason="closed")
    unchanged = await session.get(Listing, listing.id)
    await session.refresh(unchanged)
    assert unchanged.status == ListingStatus.published
    assert unchanged.next_check_due == NOW + timedelta(days=10)
