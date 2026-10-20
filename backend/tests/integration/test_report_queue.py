"""GET /reports and PATCH /reports/{id}: the staff queue. Requirements: US-12, FR-35, FR-38, NFR-06, NFR-07.

The contract is specs/backend/api-spec.md, "Phase 11 rules" under section 6. Decisions H1 to H3 and H7 in
specs/2026-10-20-reports-queue/requirements.md. All phone numbers are fictional.
"""

from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import AuditEntry, Listing, User, UserReport
from app.models.base import ListingStatus, ReportReason, ReportStatus, Role
from tests.factories import add_listing
from tests.staff_helpers import bearer_for

pytestmark = pytest.mark.anyio

NOW = datetime(2026, 10, 6, 9, 0, tzinfo=timezone.utc)
FICTIONAL_PHONE = "+2348030000000"
MASKED_PHONE = "+234******0000"


async def a_report(
    session: AsyncSession,
    listing: Listing,
    *,
    reason: ReportReason = ReportReason.wrong_number,
    status: ReportStatus = ReportStatus.open,
    hours_ago: float = 1,
    phone: str | None = None,
    comment: str | None = None,
) -> UserReport:
    report = UserReport(
        listing_id=listing.id,
        reason=reason,
        status=status,
        comment=comment,
        reporter_phone=phone,
        reporter_key="key-" + str(hours_ago) + str(listing.id) if status == ReportStatus.open else None,
        created_at=NOW - timedelta(hours=hours_ago),
    )
    session.add(report)
    await session.commit()
    return report


async def get_reports(client: AsyncClient, user: User | None, **query: object):
    headers = bearer_for(user) if user else {}
    return await client.get("/reports", params=query, headers=headers)


async def close_report(client: AsyncClient, user: User | None, report: UserReport, status: str):
    headers = bearer_for(user) if user else {}
    return await client.patch(f"/reports/{report.id}", json={"status": status}, headers=headers)


# --- who may use it ---


@pytest.mark.parametrize("role", [Role.editor, Role.admin])
async def test_an_editor_and_an_admin_can_read_the_queue(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], role: Role
) -> None:
    listing = await add_listing(session, "Night Pharmacy")
    await a_report(session, listing)

    response = await get_reports(client, demo_users[role])

    assert response.status_code == 200
    assert response.json()["total"] == 1


@pytest.mark.parametrize("role", [Role.verifier, Role.provider])
async def test_a_verifier_and_a_provider_get_403_on_both_calls(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], role: Role
) -> None:
    listing = await add_listing(session, "Night Pharmacy")
    report = await a_report(session, listing)

    assert (await get_reports(client, demo_users[role])).status_code == 403
    assert (await close_report(client, demo_users[role], report, "resolved")).status_code == 403
    await session.refresh(report)
    assert report.status == ReportStatus.open


async def test_without_a_token_both_calls_are_401(client: AsyncClient, session: AsyncSession) -> None:
    listing = await add_listing(session, "Night Pharmacy")
    report = await a_report(session, listing)

    assert (await get_reports(client, None)).status_code == 401
    assert (await close_report(client, None, report, "resolved")).status_code == 401


async def test_the_role_is_read_from_the_database_so_a_deactivated_editor_is_refused(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    editor = demo_users[Role.editor]
    editor.is_active = False
    session.add(editor)
    await session.commit()

    assert (await get_reports(client, editor)).status_code == 403


# --- the list ---


async def test_the_default_is_open_reports_and_the_status_filter_picks_the_others(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    listing = await add_listing(session, "Night Pharmacy")
    await a_report(session, listing, status=ReportStatus.open)
    await a_report(session, listing, status=ReportStatus.resolved)
    await a_report(session, listing, status=ReportStatus.dismissed)
    editor = demo_users[Role.editor]

    open_reports = (await get_reports(client, editor)).json()
    resolved = (await get_reports(client, editor, status="resolved")).json()
    dismissed = (await get_reports(client, editor, status="dismissed")).json()

    assert [item["status"] for item in open_reports["items"]] == ["open"]
    assert [item["status"] for item in resolved["items"]] == ["resolved"]
    assert [item["status"] for item in dismissed["items"]] == ["dismissed"]
    assert (await get_reports(client, editor, status="nonsense")).status_code == 422


async def test_urgent_reports_come_first_then_the_newest(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    flagged = await add_listing(session, "Flagged Clinic", status=ListingStatus.recheck_due)
    fine = await add_listing(session, "Fine Clinic")
    old_urgent = await a_report(session, flagged, reason=ReportReason.not_working, hours_ago=30)
    newest = await a_report(session, fine, reason=ReportReason.closed, hours_ago=1)
    older = await a_report(session, fine, reason=ReportReason.moved, hours_ago=5)

    items = (await get_reports(client, demo_users[Role.editor])).json()["items"]

    assert [item["id"] for item in items] == [old_urgent.id, newest.id, older.id]
    assert [item["urgent"] for item in items] == [True, False, False]


async def test_urgent_needs_the_reason_not_working_and_a_listing_in_recheck_due(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    flagged = await add_listing(session, "Flagged Clinic", status=ListingStatus.recheck_due)
    published = await add_listing(session, "Published Clinic")
    await a_report(session, flagged, reason=ReportReason.wrong_hours)
    await a_report(session, published, reason=ReportReason.not_working)

    items = (await get_reports(client, demo_users[Role.editor])).json()["items"]

    assert [item["urgent"] for item in items] == [False, False]


async def test_each_report_shows_a_small_listing_reference_even_when_the_listing_is_not_public(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    hidden = await add_listing(session, "Hidden Clinic", status=ListingStatus.hidden, area="Ogui")
    await a_report(session, hidden, reason=ReportReason.other, comment="Gate is locked")

    [item] = (await get_reports(client, demo_users[Role.editor])).json()["items"]

    assert item["listing"] == {
        "id": hidden.id,
        "slug": "hidden-clinic",
        "name": "Hidden Clinic",
        "area": "Ogui",
        "status": "hidden",
    }
    assert item["reason"] == "other"
    assert item["comment"] == "Gate is locked"
    assert item["created_at"].startswith("2026-10-06T08:00:00")
    assert item["resolved_at"] is None


async def test_the_phone_is_masked_while_it_is_stored_and_null_without_one(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    listing = await add_listing(session, "Night Pharmacy")
    with_phone = await a_report(session, listing, phone=FICTIONAL_PHONE, hours_ago=1)
    without_phone = await a_report(session, listing, phone=None, hours_ago=2)

    response = await get_reports(client, demo_users[Role.editor])

    phones = {item["id"]: item["reporter_phone"] for item in response.json()["items"]}
    assert phones == {with_phone.id: MASKED_PHONE, without_phone.id: None}
    assert FICTIONAL_PHONE not in response.text
    assert "reporter_key" not in response.text


async def test_the_list_is_paged_and_the_total_counts_all(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    listing = await add_listing(session, "Night Pharmacy")
    for hours in range(1, 6):
        await a_report(session, listing, hours_ago=hours)

    body = (await get_reports(client, demo_users[Role.editor], limit=2, offset=2)).json()

    assert body["total"] == 5
    assert len(body["items"]) == 2


# --- closing a report ---


@pytest.mark.parametrize("new_status", ["resolved", "dismissed"])
async def test_closing_deletes_the_phone_and_the_key_and_records_who_and_when(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], new_status: str
) -> None:
    listing = await add_listing(session, "Night Pharmacy")
    report = await a_report(session, listing, phone=FICTIONAL_PHONE, comment="Rang twice")
    editor = demo_users[Role.editor]

    response = await close_report(client, editor, report, new_status)

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == new_status
    assert body["reporter_phone"] is None
    assert body["resolved_at"] is not None
    await session.refresh(report)
    assert report.status.value == new_status
    assert report.reporter_phone is None  # NDPA 2023: deleted when the report is closed
    assert report.reporter_key is None
    assert report.resolved_by == editor.id
    assert report.resolved_at is not None
    assert report.comment == "Rang twice"  # only the phone and the key are deleted


async def test_dismissing_writes_the_dismiss_action(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    listing = await add_listing(session, "Night Pharmacy")
    report = await a_report(session, listing)

    await close_report(client, demo_users[Role.editor], report, "dismissed")

    [entry] = (await session.exec(select(AuditEntry))).all()
    assert (entry.action, entry.new_value) == ("report_dismiss", "dismissed")


async def test_closing_writes_an_audit_entry_without_the_phone_or_the_comment(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    listing = await add_listing(session, "Night Pharmacy")
    report = await a_report(session, listing, phone=FICTIONAL_PHONE, comment="Secret words")
    admin = demo_users[Role.admin]

    await close_report(client, admin, report, "resolved")

    [entry] = (await session.exec(select(AuditEntry))).all()
    assert entry.user_id == admin.id
    assert entry.listing_id == listing.id
    assert entry.action == "report_resolve"
    assert (entry.field_changed, entry.old_value, entry.new_value) == ("status", "open", "resolved")
    assert entry.reference == f"report-{report.id}"
    everything = " ".join(str(value) for value in entry.model_dump().values())
    assert "8030000000" not in everything
    assert "Secret words" not in everything


async def test_closing_does_not_change_the_listing(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    listing = await add_listing(session, "Flagged Clinic", status=ListingStatus.recheck_due)
    report = await a_report(session, listing, reason=ReportReason.not_working)

    await close_report(client, demo_users[Role.editor], report, "resolved")

    await session.refresh(listing)
    assert listing.status == ListingStatus.recheck_due


async def test_a_closed_report_cannot_be_closed_again(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    listing = await add_listing(session, "Night Pharmacy")
    report = await a_report(session, listing)
    editor = demo_users[Role.editor]
    await close_report(client, editor, report, "resolved")

    response = await close_report(client, editor, report, "dismissed")

    assert response.status_code == 400
    assert response.json()["detail"] == "This report is already closed."
    assert len((await session.exec(select(AuditEntry))).all()) == 1


async def test_open_is_not_a_way_to_close_and_an_unknown_report_is_404(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    listing = await add_listing(session, "Night Pharmacy")
    report = await a_report(session, listing)
    editor = demo_users[Role.editor]

    assert (await close_report(client, editor, report, "open")).status_code == 422
    unknown = await client.patch("/reports/9999", json={"status": "resolved"}, headers=bearer_for(editor))
    assert unknown.status_code == 404
    await session.refresh(report)
    assert report.status == ReportStatus.open
