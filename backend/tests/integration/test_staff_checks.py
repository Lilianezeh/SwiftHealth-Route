"""Checks of a listing: POST and GET /listings/{id}/checks. Requirements: FR-32, US-10, FR-36, FR-38, NFR-06.
Decisions C3 and C9 in specs/2026-10-20-staff-screens/. Staff alerts are replaced by a recorder.
"""

from collections.abc import Iterator
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment
from app.main import app
from app.models import AuditEntry, Listing, PhoneNumber, User, VerificationCheck
from app.models.base import ListingStatus, Role
from app.services import staff_alert_service
from app.services.staff_alert_service import StaffAlert
from tests.factories import add_listing
from tests.staff_helpers import bearer_for

pytestmark = pytest.mark.anyio

NOW = datetime(2026, 10, 6, 9, 0, tzinfo=timezone.utc)
PHOTO = "https://res.cloudinary.com/demo-cloud/image/upload/v1/swifthealth/entrances/front.jpg"
STAFF_ROLES = [Role.verifier, Role.editor, Role.admin]


@pytest.fixture
def clock() -> Iterator[None]:
    app.dependency_overrides[get_current_moment] = lambda: NOW
    yield
    app.dependency_overrides.pop(get_current_moment, None)


@pytest.fixture
def alerts(monkeypatch: pytest.MonkeyPatch) -> list[StaffAlert]:
    sent: list[StaffAlert] = []

    async def record(alert: StaffAlert) -> None:
        sent.append(alert)

    monkeypatch.setattr(staff_alert_service, "send_alerts", record)
    return sent


def check_body(**changes: object) -> dict:
    body = {
        "method": "call",
        "result": "pass",
        "person_reached": "Pharmacist on duty",
        "notes": "Hours confirmed",
    }
    body.update(changes)
    return body


async def log(client: AsyncClient, user: User, listing: Listing, **changes: object):
    return await client.post(
        f"/listings/{listing.id}/checks", json=check_body(**changes), headers=bearer_for(user)
    )


async def a_listing(session: AsyncSession, status: ListingStatus = ListingStatus.draft) -> Listing:
    listing = await add_listing(session, "Night Pharmacy", status=status)
    await session.commit()
    return listing


async def test_logging_needs_a_login_and_a_staff_role(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None, alerts: list
) -> None:
    listing = await a_listing(session)
    assert (await client.post(f"/listings/{listing.id}/checks", json=check_body())).status_code == 401
    assert (await log(client, demo_users[Role.provider], listing)).status_code == 403


@pytest.mark.parametrize("role", STAFF_ROLES)
async def test_every_staff_role_logs_a_check_on_any_listing_and_gets_201(
    client: AsyncClient,
    session: AsyncSession,
    demo_users: dict[Role, User],
    clock: None,
    alerts: list,
    role: Role,
) -> None:
    listing = await a_listing(session, ListingStatus.published)  # not created by this user (decision C3)
    response = await log(client, demo_users[role], listing)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["method"] == "call" and body["result"] == "pass"
    assert body["person_reached"] == "Pharmacist on duty"
    assert body["staff_id"] == demo_users[role].id
    assert body["staff_name"] == demo_users[role].name
    assert body["checked_at"] == "2026-10-06T09:00:00Z"


async def test_the_check_is_stored_and_audited(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None, alerts: list
) -> None:
    listing = await a_listing(session)
    verifier = demo_users[Role.verifier]
    await log(client, verifier, listing, method="visit", result="pass", notes=None, person_reached=None)
    [check] = (await session.exec(select(VerificationCheck))).all()
    assert (check.listing_id, check.staff_id, check.method.value, check.result.value) == (
        listing.id,
        verifier.id,
        "visit",
        "pass",
    )
    [entry] = (await session.exec(select(AuditEntry))).all()
    assert (entry.user_id, entry.listing_id, entry.action) == (verifier.id, listing.id, "check")
    assert entry.new_value == "visit: pass"


async def test_an_unknown_listing_is_404(
    client: AsyncClient, demo_users: dict[Role, User], clock: None, alerts: list
) -> None:
    response = await client.post(
        "/listings/99999/checks", json=check_body(), headers=bearer_for(demo_users[Role.editor])
    )
    assert response.status_code == 404


@pytest.mark.parametrize(
    "changes",
    [
        {"method": "email"},
        {"result": "maybe"},
        {"person_reached": "x" * 201},
        {"notes": "x" * 1001},
        {"photo_url": "http://res.cloudinary.com/demo/image/upload/a.jpg"},
        {"photo_url": "https://evil.example/a.jpg"},
        {"photo_url": "https://res.cloudinary.com.evil.example/a.jpg"},
        {"photo_url": "javascript:alert(1)"},
    ],
)
async def test_bad_input_is_422_and_nothing_is_stored(
    client: AsyncClient,
    session: AsyncSession,
    demo_users: dict[Role, User],
    clock: None,
    alerts: list,
    changes: dict,
) -> None:
    listing = await a_listing(session)
    assert (await log(client, demo_users[Role.verifier], listing, **changes)).status_code == 422
    assert (await session.exec(select(VerificationCheck))).all() == []


async def test_a_passing_visit_with_a_photo_sets_the_entrance_photo(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None, alerts: list
) -> None:
    listing = await a_listing(session)
    await log(client, demo_users[Role.verifier], listing, method="visit", result="pass", photo_url=PHOTO)
    await session.refresh(listing)
    assert listing.entrance_photo_url == PHOTO


@pytest.mark.parametrize(("method", "result"), [("call", "pass"), ("visit", "fail"), ("call", "fail")])
async def test_a_photo_on_any_other_check_is_kept_with_the_check_but_not_used_as_the_entrance_photo(
    client: AsyncClient,
    session: AsyncSession,
    demo_users: dict[Role, User],
    clock: None,
    alerts: list,
    method: str,
    result: str,
) -> None:
    listing = await a_listing(session)
    await log(client, demo_users[Role.verifier], listing, method=method, result=result, photo_url=PHOTO)
    await session.refresh(listing)
    assert listing.entrance_photo_url is None
    [check] = (await session.exec(select(VerificationCheck))).all()
    assert check.photo_url == PHOTO


async def test_a_passing_check_updates_last_working_at_of_the_primary_phone_only(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None, alerts: list
) -> None:
    listing = await a_listing(session)
    session.add(PhoneNumber(listing_id=listing.id, number="+2340000000777", is_primary=False))
    await session.commit()
    await log(client, demo_users[Role.verifier], listing, result="pass")
    phones = (await session.exec(select(PhoneNumber).where(PhoneNumber.listing_id == listing.id))).all()
    by_primary = {phone.is_primary: phone.last_working_at for phone in phones}
    assert by_primary[True] == NOW
    assert by_primary[False] is None


async def test_a_failing_check_does_not_touch_the_phone(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None, alerts: list
) -> None:
    listing = await a_listing(session)
    await log(client, demo_users[Role.verifier], listing, result="fail")
    [phone] = (await session.exec(select(PhoneNumber).where(PhoneNumber.listing_id == listing.id))).all()
    assert phone.last_working_at is None


async def test_a_failed_check_of_a_published_listing_hides_it_audits_it_and_tells_the_editors(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None, alerts: list
) -> None:
    listing = await a_listing(session, ListingStatus.published)
    response = await log(client, demo_users[Role.verifier], listing, method="call", result="fail")
    assert response.status_code == 201
    await session.refresh(listing)
    assert listing.status == ListingStatus.hidden  # FR-36
    entries = (await session.exec(select(AuditEntry).order_by(AuditEntry.id))).all()
    assert [entry.action for entry in entries] == ["check", "hide"]
    hide = entries[1]
    assert (hide.field_changed, hide.old_value, hide.new_value, hide.reference) == (
        "status",
        "published",
        "hidden",
        "failed re-check",
    )
    assert [alert.listing_name for alert in alerts] == ["Night Pharmacy"]
    assert alerts[0].kind == "failed_check"
    assert alerts[0].admin_phones == []  # editors are emailed; no SMS for this


@pytest.mark.parametrize(
    "status",
    [ListingStatus.draft, ListingStatus.pending_review, ListingStatus.recheck_due, ListingStatus.hidden],
)
async def test_a_failed_check_of_a_listing_that_is_not_published_changes_no_status(
    client: AsyncClient,
    session: AsyncSession,
    demo_users: dict[Role, User],
    clock: None,
    alerts: list,
    status: ListingStatus,
) -> None:
    listing = await a_listing(session, status)
    await log(client, demo_users[Role.verifier], listing, result="fail")
    await session.refresh(listing)
    assert listing.status == status
    assert alerts == []


async def test_a_passing_check_of_a_published_listing_changes_no_status(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None, alerts: list
) -> None:
    listing = await a_listing(session, ListingStatus.published)
    await log(client, demo_users[Role.verifier], listing, result="pass")
    await session.refresh(listing)
    assert listing.status == ListingStatus.published


async def test_the_history_is_newest_first_with_names_and_needs_staff(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None, alerts: list
) -> None:
    listing = await a_listing(session)
    for number, user in enumerate((demo_users[Role.verifier], demo_users[Role.editor])):
        session.add(
            VerificationCheck(
                listing_id=listing.id,
                staff_id=user.id,
                method="call",
                result="pass",
                notes=f"check {number}",
                checked_at=NOW - timedelta(days=2 - number),
            )
        )
    await session.commit()
    response = await client.get(
        f"/listings/{listing.id}/checks", headers=bearer_for(demo_users[Role.verifier])
    )
    assert response.status_code == 200
    items = response.json()["items"]
    assert [item["notes"] for item in items] == ["check 1", "check 0"]
    assert [item["staff_name"] for item in items] == [
        demo_users[Role.editor].name,
        demo_users[Role.verifier].name,
    ]
    assert response.json()["total"] == 2
    assert (await client.get(f"/listings/{listing.id}/checks")).status_code == 401
    assert (
        await client.get(f"/listings/{listing.id}/checks", headers=bearer_for(demo_users[Role.provider]))
    ).status_code == 403
    assert (
        await client.get("/listings/99999/checks", headers=bearer_for(demo_users[Role.editor]))
    ).status_code == 404
