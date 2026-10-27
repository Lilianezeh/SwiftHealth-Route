"""Moving and closing a facility, and its address history. Requirements: FR-53, US-20, FR-38, NFR-06.
Spec: specs/backend/api-spec.md section 7, "Phase 8a"; decision D3 of
specs/2026-10-23-accounts-and-facility-ownership/.

(`test_listing_moves.py` is about the moves between STATUSES: submit, publish, hide, reopen. This file
is about the moves of a facility to a new ADDRESS, and about closing one.) A move writes the old and the
new values, puts a published listing to `recheck_due` so it leaves the public at once, and never lets an
owner set the map pin. A closure hides the listing and keeps every row. Every name, address and number
here is fictional.
"""

from collections.abc import Iterator
from datetime import datetime, time, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment
from app.core.config import DEFAULT_MAP_CENTRE
from app.main import app
from app.models import AuditEntry, Listing, OpeningHours, PhoneNumber, Service, User, VerificationCheck
from app.models.base import CheckMethod, CheckResult, ListingStatus, Role
from app.services import recheck_service, staff_alert_service
from app.services.staff_alert_service import StaffAlert
from tests.factories import add_listing, add_owner_link, every_day, get_or_add_category
from tests.staff_helpers import bearer_for

pytestmark = pytest.mark.anyio

NOW = datetime(2026, 10, 27, 9, 0, tzinfo=timezone.utc)
OLD_ADDRESS = "1 Example Road"
NEW_ADDRESS = "9 New Road"


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


@pytest.fixture
async def clinic(session: AsyncSession) -> Listing:
    listing = await add_listing(
        session, "Eze Clinic", category_slug="clinic", area="GRA", service_names=("X-ray",),
        opening_hours=every_day(time(8, 0), time(17, 0)),
        next_check_due=NOW + timedelta(days=60),
    )
    await session.commit()
    return listing


@pytest.fixture
def owner(demo_users: dict[Role, User]) -> User:
    return demo_users[Role.provider]


async def move(client: AsyncClient, user: User | None, listing: Listing, **changes: object):
    body = {"address": NEW_ADDRESS, "area": "Ogui", **changes}
    return await client.post(
        f"/listings/{listing.id}/move", json=body, headers=bearer_for(user) if user else {}
    )


async def close(client: AsyncClient, user: User | None, listing: Listing, reason: str = "Moved away"):
    return await client.post(
        f"/listings/{listing.id}/close", json={"reason": reason}, headers=bearer_for(user) if user else {}
    )


async def history(client: AsyncClient, user: User | None, listing: Listing):
    return await client.get(
        f"/listings/{listing.id}/address-history", headers=bearer_for(user) if user else {}
    )


async def reload(session: AsyncSession, listing: Listing) -> Listing:
    await session.refresh(listing)
    return listing


async def audit(session: AsyncSession, action: str | None = None) -> list[AuditEntry]:
    query = select(AuditEntry).order_by(AuditEntry.id)
    if action:
        query = query.where(AuditEntry.action == action)
    return list((await session.exec(query)).all())


async def moved_values(session: AsyncSession, field: str) -> list[tuple[str | None, str | None]]:
    """The (old, new) values of one field in the `move` rows, in the order they were written."""
    rows = await audit(session, "move")
    return [(row.old_value, row.new_value) for row in rows if row.field_changed == field]


def unknown_listing() -> Listing:
    """A listing object that is not in the database: only its id is used, to ask for a missing listing."""
    return Listing(
        id=999999, slug="x", name="x", category_id=1, area="GRA", address="x", latitude=0, longitude=0
    )


async def public_names(client: AsyncClient) -> list[str]:
    return [item["name"] for item in (await client.get("/search")).json()["items"]]


# ---------- who may move ----------


async def test_an_editor_moves_a_listing_and_the_answer_says_what_changed(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clinic: Listing, clock: None
) -> None:
    response = await move(client, demo_users[Role.editor], clinic, landmark="Beside the market")

    assert response.status_code == 200, response.text
    assert response.json() == {
        "listing_id": clinic.id,
        "status": "recheck_due",
        "changed": ["address", "area", "landmark"],
        "pin_needs_setting": False,
        "message": "Moved. The listing is hidden until our team re-checks it.",
    }
    moved = await reload(session, clinic)
    assert (moved.address, moved.area, moved.landmark) == (NEW_ADDRESS, "Ogui", "Beside the market")


@pytest.mark.parametrize("role", [Role.admin, Role.editor])
async def test_editors_and_admins_may_move_any_listing(
    client: AsyncClient, demo_users: dict[Role, User], clinic: Listing, clock: None, role: Role
) -> None:
    assert (await move(client, demo_users[role], clinic)).status_code == 200


async def test_an_owner_and_a_manager_with_an_approved_link_may_move(
    client: AsyncClient, session: AsyncSession, owner: User, clinic: Listing, clock: None
) -> None:
    link = await add_owner_link(session, clinic, owner, role="manager")
    await session.commit()
    assert (await move(client, owner, clinic)).status_code == 200
    link.role = "owner"
    session.add(link)
    await session.commit()
    assert (await move(client, owner, clinic, address="12 Third Road")).status_code == 200


async def test_a_verifier_cannot_move(
    client: AsyncClient, demo_users: dict[Role, User], clinic: Listing, clock: None
) -> None:
    assert (await move(client, demo_users[Role.verifier], clinic)).status_code == 403


@pytest.mark.parametrize("state", ["pending", "removed", "none"])
async def test_a_provider_without_an_approved_link_cannot_move(
    client: AsyncClient, session: AsyncSession, owner: User, clinic: Listing, clock: None, state: str
) -> None:
    if state != "none":
        await add_owner_link(session, clinic, owner, status=state)
        await session.commit()
    assert (await move(client, owner, clinic)).status_code == 403
    assert (await reload(session, clinic)).address == OLD_ADDRESS
    assert await audit(session, "move") == []


async def test_anonymous_is_401_and_an_unknown_listing_is_404(
    client: AsyncClient, demo_users: dict[Role, User], clinic: Listing, clock: None
) -> None:
    assert (await move(client, None, clinic)).status_code == 401
    missing = unknown_listing()
    assert (await move(client, demo_users[Role.editor], missing)).status_code == 404


# ---------- what a move writes ----------


async def test_a_move_writes_one_audit_row_per_changed_field_with_old_and_new_values(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clinic: Listing, clock: None
) -> None:
    editor = demo_users[Role.editor]
    await move(client, editor, clinic)

    rows = [
        (row.field_changed, row.old_value, row.new_value, row.user_id, row.listing_id, row.changed_at)
        for row in await audit(session, "move")
    ]
    assert rows == [
        ("address", OLD_ADDRESS, NEW_ADDRESS, editor.id, clinic.id, NOW),
        ("area", "GRA", "Ogui", editor.id, clinic.id, NOW),
        ("status", "published", "recheck_due", editor.id, clinic.id, NOW),
    ]


async def test_a_value_that_did_not_change_writes_no_row(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clinic: Listing, clock: None
) -> None:
    await move(client, demo_users[Role.editor], clinic, area="GRA")
    assert [row.field_changed for row in await audit(session, "move")] == ["address", "status"]


async def test_a_second_move_adds_a_second_set_and_never_loses_the_first(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clinic: Listing, clock: None
) -> None:
    editor = demo_users[Role.editor]
    await move(client, editor, clinic)
    await move(client, editor, clinic, address="12 Third Road", area="GRA")

    addresses = await moved_values(session, "address")
    assert addresses == [(OLD_ADDRESS, NEW_ADDRESS), (NEW_ADDRESS, "12 Third Road")]


async def test_nothing_changed_is_400_and_writes_nothing(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clinic: Listing, clock: None
) -> None:
    response = await move(client, demo_users[Role.editor], clinic, address=OLD_ADDRESS, area="GRA")
    assert response.status_code == 400
    assert response.json()["detail"] == "Nothing changed."
    assert await audit(session) == []
    assert (await reload(session, clinic)).status == ListingStatus.published


async def test_the_landmark_can_be_set_and_cleared(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clinic: Listing, clock: None
) -> None:
    editor = demo_users[Role.editor]
    await move(client, editor, clinic, landmark="Beside the market")
    await move(client, editor, clinic, landmark=None)

    assert (await reload(session, clinic)).landmark is None
    landmark_rows = await moved_values(session, "landmark")
    assert landmark_rows == [(None, "Beside the market"), ("Beside the market", None)]


@pytest.mark.parametrize(
    "changes",
    [
        {"address": "ab"},
        {"address": "x" * 201},
        {"area": "Atlantis"},
        {"landmark": "x" * 201},
        {"latitude": 6.5},
        {"longitude": 7.5},
        {"latitude": 91, "longitude": 7.5},
    ],
)
async def test_bad_input_is_422_and_nothing_changes(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clinic: Listing, clock: None,
    changes: dict,
) -> None:
    response = await move(client, demo_users[Role.editor], clinic, **changes)
    assert response.status_code == 422, response.text
    assert (await reload(session, clinic)).address == OLD_ADDRESS


# ---------- status and the public ----------


async def test_a_published_listing_leaves_the_public_at_once_and_comes_back_only_after_publish(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clinic: Listing, clock: None
) -> None:
    editor = demo_users[Role.editor]
    assert await public_names(client) == ["Eze Clinic"]

    await move(client, editor, clinic)

    moved = await reload(session, clinic)
    assert (moved.status, moved.next_check_due) == (ListingStatus.recheck_due, NOW)
    assert await public_names(client) == []
    assert (await client.get(f"/listings/{clinic.slug}")).status_code == 404

    session.add(VerificationCheck(
        listing_id=clinic.id, staff_id=editor.id, method=CheckMethod.call, result=CheckResult.passed,
        checked_at=NOW - timedelta(days=1),
    ))
    await session.commit()
    published = await client.post(f"/listings/{clinic.id}/publish", headers=bearer_for(editor))
    assert published.status_code == 200, published.text
    assert await public_names(client) == ["Eze Clinic"]


@pytest.mark.parametrize(
    "status", [ListingStatus.draft, ListingStatus.pending_review, ListingStatus.hidden]
)
async def test_a_listing_that_is_not_public_keeps_its_status(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], status: ListingStatus,
    clock: None,
) -> None:
    listing = await add_listing(session, "Quiet Clinic", category_slug="clinic", status=status)
    await session.commit()

    response = await move(client, demo_users[Role.editor], listing)

    assert response.status_code == 200
    assert response.json()["status"] == status.value
    assert (await reload(session, listing)).status == status
    assert [row.field_changed for row in await audit(session, "move")] == ["address", "area"]


async def test_a_recheck_due_listing_stays_recheck_due_and_is_due_now(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    listing = await add_listing(
        session, "Lapsed Clinic", category_slug="clinic", status=ListingStatus.recheck_due,
        next_check_due=NOW - timedelta(days=5),
    )
    await session.commit()

    await move(client, demo_users[Role.editor], listing)

    moved = await reload(session, listing)
    assert (moved.status, moved.next_check_due) == (ListingStatus.recheck_due, NOW)


# ---------- the pin ----------


async def test_an_owners_move_resets_the_pin_to_the_default_centre_and_ignores_a_pin_sent(
    client: AsyncClient, session: AsyncSession, owner: User, clinic: Listing, clock: None
) -> None:
    await add_owner_link(session, clinic, owner)
    await session.commit()

    response = await move(client, owner, clinic, latitude=6.5, longitude=7.6)

    assert response.json()["pin_needs_setting"] is True
    moved = await reload(session, clinic)
    assert (moved.latitude, moved.longitude) == DEFAULT_MAP_CENTRE
    fields = [row.field_changed for row in await audit(session, "move")]
    assert [field for field in fields if field in ("latitude", "longitude")] == ["latitude", "longitude"]


async def test_an_owners_move_is_marked_by_owner_in_the_audit_rows(
    client: AsyncClient, session: AsyncSession, owner: User, clinic: Listing, clock: None
) -> None:
    await add_owner_link(session, clinic, owner)
    await session.commit()
    await move(client, owner, clinic)
    assert {row.reference for row in await audit(session, "move")} == {"by-owner"}
    assert {row.user_id for row in await audit(session, "move")} == {owner.id}


async def test_an_editors_pin_is_used_and_without_a_pin_the_old_one_stays(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clinic: Listing, clock: None
) -> None:
    editor = demo_users[Role.editor]
    first = await move(client, editor, clinic)
    assert first.json()["pin_needs_setting"] is False
    assert (await reload(session, clinic)).latitude == 6.45

    second = await move(client, editor, clinic, address="12 Third Road", latitude=6.5, longitude=7.6)

    assert second.json()["pin_needs_setting"] is False
    moved = await reload(session, clinic)
    assert (moved.latitude, moved.longitude) == (6.5, 7.6)
    assert {row.reference for row in await audit(session, "move")} == {None}


async def test_the_staff_detail_says_the_pin_is_the_default_after_an_owners_move(
    client: AsyncClient, session: AsyncSession, owner: User, demo_users: dict[Role, User], clinic: Listing,
    clock: None,
) -> None:
    await add_owner_link(session, clinic, owner)
    await session.commit()
    await move(client, owner, clinic)
    detail = await client.get(f"/listings/id/{clinic.id}", headers=bearer_for(demo_users[Role.editor]))
    assert detail.json()["map_pin_is_default"] is True


# ---------- alerts ----------


async def test_the_editors_and_admins_are_told_when_an_owner_moves_a_listing_but_not_when_staff_do(
    client: AsyncClient, session: AsyncSession, owner: User, demo_users: dict[Role, User], clinic: Listing,
    alerts: list[StaffAlert], clock: None,
) -> None:
    await add_owner_link(session, clinic, owner)
    await session.commit()

    await move(client, demo_users[Role.editor], clinic)
    assert alerts == []

    await move(client, owner, clinic, address="12 Third Road")

    [alert] = alerts
    assert (alert.kind, alert.listing_name, alert.admin_phones) == ("moved", "Eze Clinic", [])
    assert set(alert.editor_emails) == {demo_users[Role.editor].email, demo_users[Role.admin].email}


def test_the_alert_texts_hold_the_listing_name_and_nothing_else() -> None:
    moved_subject, moved_body = staff_alert_service.build_owner_change_texts("Eze Clinic", "moved")
    closed_subject, closed_body = staff_alert_service.build_owner_change_texts("Eze Clinic", "closed")
    assert "Eze Clinic" in moved_subject and "Eze Clinic" in moved_body
    assert "Eze Clinic" in closed_subject and "Eze Clinic" in closed_body
    assert moved_subject != closed_subject


# ---------- closing ----------


async def test_an_editor_closes_a_listing(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clinic: Listing, clock: None
) -> None:
    editor = demo_users[Role.editor]

    response = await close(client, editor, clinic, "Closed down in October")

    assert response.status_code == 200, response.text
    assert response.json() == {
        "listing_id": clinic.id, "status": "hidden", "closed_at": "2026-10-27T09:00:00Z",
    }
    closed = await reload(session, clinic)
    assert (closed.status, closed.closed_at, closed.closed_reason) == (
        ListingStatus.hidden, NOW, "Closed down in October",
    )
    [row] = await audit(session, "close")
    assert (row.field_changed, row.old_value, row.new_value, row.reference, row.user_id) == (
        "status", "published", "hidden", "Closed down in October", editor.id,
    )


async def test_an_approved_owner_may_close_but_a_manager_may_not(
    client: AsyncClient, session: AsyncSession, owner: User, clinic: Listing, clock: None
) -> None:
    link = await add_owner_link(session, clinic, owner, role="manager")
    await session.commit()
    assert (await close(client, owner, clinic)).status_code == 403
    assert (await reload(session, clinic)).closed_at is None

    link.role = "owner"
    session.add(link)
    await session.commit()
    assert (await close(client, owner, clinic)).status_code == 200


@pytest.mark.parametrize("state", ["pending", "removed", "none"])
async def test_a_provider_without_an_approved_link_cannot_close(
    client: AsyncClient, session: AsyncSession, owner: User, clinic: Listing, clock: None, state: str
) -> None:
    if state != "none":
        await add_owner_link(session, clinic, owner, status=state)
        await session.commit()
    assert (await close(client, owner, clinic)).status_code == 403


async def test_a_verifier_cannot_close_and_anonymous_is_401(
    client: AsyncClient, demo_users: dict[Role, User], clinic: Listing, clock: None
) -> None:
    assert (await close(client, demo_users[Role.verifier], clinic)).status_code == 403
    assert (await close(client, None, clinic)).status_code == 401


@pytest.mark.parametrize("reason", ["", "ab", "x" * 201])
async def test_a_bad_reason_is_422(
    client: AsyncClient, demo_users: dict[Role, User], clinic: Listing, clock: None, reason: str
) -> None:
    assert (await close(client, demo_users[Role.editor], clinic, reason)).status_code == 422


async def test_closing_twice_is_400(
    client: AsyncClient, demo_users: dict[Role, User], clinic: Listing, clock: None
) -> None:
    editor = demo_users[Role.editor]
    await close(client, editor, clinic)
    response = await close(client, editor, clinic)
    assert response.status_code == 400
    assert response.json()["detail"] == "This listing is already closed."


async def test_closing_keeps_phones_hours_services_checks_and_audit(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clinic: Listing, clock: None
) -> None:
    editor = demo_users[Role.editor]
    session.add(VerificationCheck(
        listing_id=clinic.id, staff_id=editor.id, method=CheckMethod.visit, result=CheckResult.passed,
        checked_at=NOW - timedelta(days=3),
    ))
    await session.commit()
    await move(client, editor, clinic)
    before = {
        table: len((await session.exec(select(table))).all())
        for table in (PhoneNumber, OpeningHours, Service, VerificationCheck, AuditEntry)
    }

    await close(client, editor, clinic)

    for table, count in before.items():
        extra = 1 if table is AuditEntry else 0  # the closing itself
        assert len((await session.exec(select(table))).all()) == count + extra, table.__name__
    assert len((await session.exec(select(Listing))).all()) == 1


async def test_a_closed_listing_is_not_found_by_search_emergency_or_its_page(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    ambulance = await get_or_add_category(session, "ambulance", "Ambulance")
    ambulance.is_emergency = True
    session.add(ambulance)
    pharmacy = await add_listing(session, "Night Pharmacy", category_slug="pharmacy")
    rescue = await add_listing(session, "Rescue Ambulance", category_slug="ambulance")
    await session.commit()
    assert "Night Pharmacy" in await public_names(client)
    assert "Rescue Ambulance" in (await client.get("/emergency")).text

    editor = demo_users[Role.editor]
    await close(client, editor, pharmacy)
    await close(client, editor, rescue)

    assert "Night Pharmacy" not in await public_names(client)
    assert "Rescue Ambulance" not in (await client.get("/emergency")).text
    assert (await client.get(f"/listings/{pharmacy.slug}")).status_code == 404
    assert (await client.get(f"/listings/{rescue.slug}")).status_code == 404


async def test_a_closed_listing_cannot_be_moved(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clinic: Listing, clock: None
) -> None:
    editor = demo_users[Role.editor]
    await close(client, editor, clinic)
    response = await move(client, editor, clinic)
    assert response.status_code == 400
    assert response.json()["detail"] == "A closed listing cannot be moved. Reopen it first."
    assert (await reload(session, clinic)).address == OLD_ADDRESS


async def test_the_staff_detail_shows_the_closure(
    client: AsyncClient, demo_users: dict[Role, User], clinic: Listing, clock: None
) -> None:
    editor = demo_users[Role.editor]
    open_detail = (await client.get(f"/listings/id/{clinic.id}", headers=bearer_for(editor))).json()
    assert (open_detail["closed_at"], open_detail["closed_reason"]) == (None, None)

    await close(client, editor, clinic, "Closed down")

    detail = (await client.get(f"/listings/id/{clinic.id}", headers=bearer_for(editor))).json()
    assert (detail["closed_at"], detail["closed_reason"]) == ("2026-10-27T09:00:00Z", "Closed down")


async def test_reopening_clears_the_closure_and_the_listing_can_be_moved_again(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clinic: Listing, clock: None
) -> None:
    editor = demo_users[Role.editor]
    await close(client, editor, clinic)

    reopened = await client.post(f"/listings/{clinic.id}/reopen", headers=bearer_for(editor))

    assert reopened.status_code == 200, reopened.text
    after = await reload(session, clinic)
    assert (after.status, after.closed_at, after.closed_reason) == (ListingStatus.draft, None, None)
    assert (await move(client, editor, clinic)).status_code == 200


async def test_the_nightly_job_leaves_a_closed_listing_alone(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    listing = await add_listing(
        session, "Old Clinic", category_slug="clinic", next_check_due=NOW - timedelta(days=30)
    )
    await session.commit()
    await close(client, demo_users[Role.editor], listing)

    moved = await recheck_service.move_overdue_to_recheck(session, NOW + timedelta(days=1))

    assert moved == []
    assert (await reload(session, listing)).status == ListingStatus.hidden


async def test_the_editors_and_admins_are_told_when_an_owner_closes_a_listing(
    client: AsyncClient, session: AsyncSession, owner: User, demo_users: dict[Role, User], clinic: Listing,
    alerts: list[StaffAlert], clock: None,
) -> None:
    await add_owner_link(session, clinic, owner)
    await session.commit()

    await close(client, owner, clinic)

    [alert] = alerts
    assert (alert.kind, alert.listing_name) == ("closed", "Eze Clinic")
    assert set(alert.editor_emails) == {demo_users[Role.editor].email, demo_users[Role.admin].email}


async def test_no_alert_when_an_editor_closes_it(
    client: AsyncClient, demo_users: dict[Role, User], clinic: Listing, alerts: list[StaffAlert], clock: None
) -> None:
    await close(client, demo_users[Role.editor], clinic)
    assert alerts == []


# ---------- the address history ----------


async def test_the_history_is_newest_first_and_includes_older_edits_of_the_address(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clinic: Listing, clock: None
) -> None:
    editor = demo_users[Role.editor]
    session.add(AuditEntry(
        user_id=editor.id, listing_id=clinic.id, action="update", field_changed="address",
        old_value="Old Street 0", new_value=OLD_ADDRESS, changed_at=NOW - timedelta(days=100),
    ))
    session.add(AuditEntry(
        user_id=editor.id, listing_id=clinic.id, action="update", field_changed="name",
        old_value="A", new_value="B", changed_at=NOW - timedelta(days=50),
    ))
    await session.commit()
    await move(client, editor, clinic)

    response = await history(client, editor, clinic)

    assert response.status_code == 200, response.text
    items = response.json()["items"]
    assert [(item["field"], item["old_value"], item["new_value"], item["kind"]) for item in items] == [
        ("address", OLD_ADDRESS, NEW_ADDRESS, "move"),
        ("area", "GRA", "Ogui", "move"),
        ("address", "Old Street 0", OLD_ADDRESS, "edit"),
    ]
    assert items[0]["changed_at"] == "2026-10-27T09:00:00Z"
    assert items[0]["by"] == editor.name


async def test_the_history_of_a_listing_never_moved_is_empty(
    client: AsyncClient, demo_users: dict[Role, User], clinic: Listing, clock: None
) -> None:
    response = await history(client, demo_users[Role.verifier], clinic)
    assert response.status_code == 200
    assert response.json() == {"items": []}


async def test_an_owner_sees_the_history_without_any_staff_name(
    client: AsyncClient, session: AsyncSession, owner: User, demo_users: dict[Role, User], clinic: Listing,
    clock: None,
) -> None:
    await add_owner_link(session, clinic, owner, role="manager")
    await session.commit()
    await move(client, demo_users[Role.editor], clinic)

    response = await history(client, owner, clinic)

    assert response.status_code == 200
    assert [item["by"] for item in response.json()["items"]] == [None, None]
    assert demo_users[Role.editor].name not in response.text


@pytest.mark.parametrize("state", ["pending", "removed", "none"])
async def test_a_provider_without_an_approved_link_cannot_read_the_history(
    client: AsyncClient, session: AsyncSession, owner: User, clinic: Listing, clock: None, state: str
) -> None:
    if state != "none":
        await add_owner_link(session, clinic, owner, status=state)
        await session.commit()
    assert (await history(client, owner, clinic)).status_code == 403


async def test_the_history_needs_a_login_and_an_existing_listing(
    client: AsyncClient, demo_users: dict[Role, User], clinic: Listing, clock: None
) -> None:
    assert (await history(client, None, clinic)).status_code == 401
    missing = unknown_listing()
    assert (await history(client, demo_users[Role.editor], missing)).status_code == 404


# ---------- no deletes ----------


def test_no_route_deletes_anything() -> None:
    paths = app.openapi()["paths"]  # every route of the API, whatever router it was included from
    assert len(paths) > 50
    assert [path for path, methods in paths.items() if "delete" in methods] == []
