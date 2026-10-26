"""The activity log: who did what and when. Requirements: FR-55, FR-38, US-18, NFR-07.
Spec: specs/backend/api-spec.md section 11, "Phase 4a", `GET /admin/activity`. Admin only, newest first,
filters and paging.
Every name, address and number here is fictional.
"""

from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import AuditEntry, User
from app.models.base import Role
from app.repositories import audit_repository
from tests.factories import add_listing
from tests.staff_helpers import bearer_for

pytestmark = pytest.mark.anyio

ITEM_FIELDS = {
    "id", "at", "user_id", "user_name", "action", "listing_id", "listing_name",
    "target_user_id", "target_user_name", "field_changed", "old_value", "new_value",
}


def moment(day: int, hour: int = 12) -> datetime:
    return datetime(2026, 10, day, hour, 0, tzinfo=timezone.utc)


async def add_entry(session: AsyncSession, when: datetime, **fields: object) -> AuditEntry:
    user_id = fields.pop("user_id", None)
    listing_id = fields.pop("listing_id", None)
    action = str(fields.pop("action", "update"))
    entry = await audit_repository.add_entry(
        session,
        user_id=user_id,  # type: ignore[arg-type]
        listing_id=listing_id,  # type: ignore[arg-type]
        action=action,
        changed_at=when,
        **fields,  # type: ignore[arg-type]
    )
    await session.commit()
    return entry


async def activity(client: AsyncClient, caller: User, query: str = "") -> dict:
    response = await client.get(f"/admin/activity{query}", headers=bearer_for(caller))
    assert response.status_code == 200, response.text
    return response.json()


async def test_an_item_names_the_person_the_listing_and_the_account_it_was_about(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    admin, editor = demo_users[Role.admin], demo_users[Role.editor]
    listing = await add_listing(session, "Night Pharmacy A")
    await add_entry(
        session, moment(20), user_id=admin.id, listing_id=listing.id, action="update",
        field_changed="phone", old_value="a", new_value="b",
    )
    await add_entry(
        session, moment(21), user_id=admin.id, action="user_suspend", field_changed="is_active",
        old_value="true", new_value="false", reference=f"user:{editor.id}",
    )

    body = await activity(client, admin)

    suspend, update = body["items"]
    assert set(suspend) == ITEM_FIELDS
    assert (suspend["action"], suspend["user_name"]) == ("user_suspend", "Demo Admin")
    assert (suspend["target_user_id"], suspend["target_user_name"]) == (editor.id, "Demo Editor")
    assert (suspend["listing_id"], suspend["listing_name"]) == (None, None)
    assert (update["listing_id"], update["listing_name"]) == (listing.id, "Night Pharmacy A")
    assert update["target_user_id"] is None
    assert (update["field_changed"], update["old_value"], update["new_value"]) == ("phone", "a", "b")
    assert update["at"].startswith("2026-10-20T12:00")


async def test_newest_first_and_the_total_counts_every_match(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    for day in (3, 9, 5):
        await add_entry(session, moment(day), action=f"day_{day}")

    body = await activity(client, demo_users[Role.admin])

    assert [item["action"] for item in body["items"]] == ["day_9", "day_5", "day_3"]
    assert body["total"] == 3


async def test_an_entry_with_no_person_and_no_listing_has_null_names(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    await add_entry(session, moment(4), action="recheck_due")  # the nightly job

    [item] = (await activity(client, demo_users[Role.admin]))["items"]

    assert (item["user_id"], item["user_name"], item["listing_name"]) == (None, None, None)


async def test_the_reference_column_is_never_returned(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    """It can hold a Paystack reference; the log shows a payment as an action, not its reference."""
    await add_entry(session, moment(4), action="payment", reference="PSK_test_abc123")

    body = await activity(client, demo_users[Role.admin])

    assert "PSK_test_abc123" not in str(body) and "reference" not in body["items"][0]
    assert body["items"][0]["target_user_id"] is None


async def test_filter_by_person(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    admin, editor = demo_users[Role.admin], demo_users[Role.editor]
    await add_entry(session, moment(4), user_id=admin.id, action="by_admin")
    await add_entry(session, moment(5), user_id=editor.id, action="by_editor")

    body = await activity(client, admin, f"?user_id={editor.id}")

    assert [item["action"] for item in body["items"]] == ["by_editor"]
    assert body["total"] == 1


async def test_filter_by_action_is_exact(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    await add_entry(session, moment(4), action="user_approve")
    await add_entry(session, moment(5), action="user_approve_extra")
    await add_entry(session, moment(6), action="user_reject")

    body = await activity(client, demo_users[Role.admin], "?action=user_approve")

    assert [item["action"] for item in body["items"]] == ["user_approve"]


async def test_filter_by_dates_includes_both_ends_as_lagos_days(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    # Lagos is UTC+1: 23:30 UTC on the 9th is 00:30 on the 10th there, so it belongs to the 10th.
    utc = timezone.utc
    evening_of_the_8th = datetime(2026, 10, 8, 22, 0, tzinfo=utc)  # 23:00 on the 8th in Lagos
    after_midnight = datetime(2026, 10, 9, 23, 30, tzinfo=utc)  # 00:30 on the 10th
    late_on_the_10th = datetime(2026, 10, 10, 22, 30, tzinfo=utc)  # 23:30 on the 10th
    on_the_11th = datetime(2026, 10, 10, 23, 30, tzinfo=utc)  # 00:30 on the 11th
    await add_entry(session, evening_of_the_8th, action="a_8th_evening")
    await add_entry(session, after_midnight, action="b_10th_after_midnight")
    await add_entry(session, late_on_the_10th, action="c_10th_late")
    await add_entry(session, on_the_11th, action="d_11th")
    admin = demo_users[Role.admin]

    one_day = await activity(client, admin, "?from=2026-10-10&to=2026-10-10")
    from_only = await activity(client, admin, "?from=2026-10-10")
    to_only = await activity(client, admin, "?to=2026-10-09")

    assert sorted(item["action"] for item in one_day["items"]) == ["b_10th_after_midnight", "c_10th_late"]
    assert len(from_only["items"]) == 3
    assert [item["action"] for item in to_only["items"]] == ["a_8th_evening"]


async def test_filters_combine(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    admin = demo_users[Role.admin]
    await add_entry(session, moment(4), user_id=admin.id, action="user_approve")
    await add_entry(session, moment(12), user_id=admin.id, action="user_approve")
    await add_entry(session, moment(12), user_id=admin.id, action="user_reject")

    body = await activity(client, admin, f"?user_id={admin.id}&action=user_approve&from=2026-10-10")

    assert body["total"] == 1


async def test_paging(client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession) -> None:
    for day in range(1, 8):
        await add_entry(session, moment(day), action=f"day_{day}")
    admin = demo_users[Role.admin]

    first = await activity(client, admin, "?limit=3")
    second = await activity(client, admin, "?limit=3&offset=3")
    third = await activity(client, admin, "?limit=3&offset=6")

    assert [item["action"] for item in first["items"]] == ["day_7", "day_6", "day_5"]
    assert [item["action"] for item in second["items"]] == ["day_4", "day_3", "day_2"]
    assert [item["action"] for item in third["items"]] == ["day_1"]
    assert first["total"] == second["total"] == third["total"] == 7


async def test_the_default_page_is_50(
    client: AsyncClient, demo_users: dict[Role, User], session: AsyncSession
) -> None:
    for number in range(55):
        when = moment(1) + timedelta(minutes=number)
        session.add(AuditEntry(user_id=None, listing_id=None, action=f"n{number}", changed_at=when))
    await session.commit()

    body = await activity(client, demo_users[Role.admin])

    assert body["total"] == 55 and len(body["items"]) == 50


@pytest.mark.parametrize(
    "query", ["?limit=0", "?limit=201", "?offset=-1", "?from=yesterday", "?to=2026-13-40", "?user_id=abc"]
)
async def test_bad_values_are_422(client: AsyncClient, demo_users: dict[Role, User], query: str) -> None:
    response = await client.get(f"/admin/activity{query}", headers=bearer_for(demo_users[Role.admin]))

    assert response.status_code == 422


@pytest.mark.parametrize("role", [Role.editor, Role.verifier, Role.provider])
async def test_only_an_admin_may_read_it(
    client: AsyncClient, demo_users: dict[Role, User], role: Role
) -> None:
    assert (await client.get("/admin/activity", headers=bearer_for(demo_users[role]))).status_code == 403


async def test_anonymous_is_401(client: AsyncClient) -> None:
    assert (await client.get("/admin/activity")).status_code == 401
