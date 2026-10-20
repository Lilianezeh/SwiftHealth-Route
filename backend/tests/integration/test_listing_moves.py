"""Status moves: submit, publish, hide, reopen. Requirements: FR-32, FR-33, FR-38, NFR-06.
The table of statuses is in specs/prd.md; the rules: specs/backend/api-spec.md, "Phase 10 clarifications".
Decisions C3 and C4 in specs/2026-10-20-staff-screens/requirements.md.
"""

from collections.abc import Iterator
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment
from app.main import app
from app.models import AuditEntry, Listing, User, VerificationCheck
from app.models.base import CheckMethod, CheckResult, ListingStatus, Role
from tests.factories import add_listing, get_or_add_category
from tests.staff_helpers import bearer_for

pytestmark = pytest.mark.anyio

NOW = datetime(2026, 10, 6, 9, 0, tzinfo=timezone.utc)


@pytest.fixture
def clock() -> Iterator[None]:
    app.dependency_overrides[get_current_moment] = lambda: NOW
    yield
    app.dependency_overrides.pop(get_current_moment, None)


async def a_listing(
    session: AsyncSession, status: ListingStatus, creator: User | None = None, category: str = "pharmacy"
) -> Listing:
    listing = await add_listing(session, f"Place {status.value}", status=status, category_slug=category)
    listing.created_by = creator.id if creator else None
    session.add(listing)
    await session.commit()
    return listing


async def add_check(
    session: AsyncSession,
    listing: Listing,
    staff: User,
    method: CheckMethod,
    result: CheckResult,
    days_ago: float = 1,
) -> None:
    session.add(
        VerificationCheck(
            listing_id=listing.id,
            staff_id=staff.id,
            method=method,
            result=result,
            checked_at=NOW - timedelta(days=days_ago),
        )
    )
    await session.commit()


async def move(client: AsyncClient, user: User, listing: Listing, action: str, **body: object):
    return await client.post(f"/listings/{listing.id}/{action}", json=body or None, headers=bearer_for(user))


async def audit(session: AsyncSession) -> list[AuditEntry]:
    return list((await session.exec(select(AuditEntry).order_by(AuditEntry.id))).all())


# --- submit ---


async def test_submit_moves_a_draft_to_pending_review_with_a_passing_call_and_visit(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    verifier = demo_users[Role.verifier]
    listing = await a_listing(session, ListingStatus.draft, verifier)
    await add_check(session, listing, verifier, CheckMethod.call, CheckResult.passed)
    await add_check(session, listing, verifier, CheckMethod.visit, CheckResult.passed)
    response = await move(client, verifier, listing, "submit")
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "pending_review"
    [entry] = await audit(session)
    assert (entry.user_id, entry.action, entry.field_changed, entry.old_value, entry.new_value) == (
        verifier.id,
        "submit",
        "status",
        "draft",
        "pending_review",
    )


@pytest.mark.parametrize(
    "checks",
    [
        [],
        [(CheckMethod.call, CheckResult.passed)],
        [(CheckMethod.visit, CheckResult.passed)],
        [(CheckMethod.call, CheckResult.passed), (CheckMethod.visit, CheckResult.failed)],
        [(CheckMethod.call, CheckResult.failed), (CheckMethod.visit, CheckResult.passed)],
    ],
)
async def test_submit_without_a_passing_call_and_a_passing_visit_is_400(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None, checks: list
) -> None:
    verifier = demo_users[Role.verifier]
    listing = await a_listing(session, ListingStatus.draft, verifier)
    for method, result in checks:
        await add_check(session, listing, verifier, method, result)
    response = await move(client, verifier, listing, "submit")
    assert response.status_code == 400
    await session.refresh(listing)
    assert listing.status == ListingStatus.draft
    assert await audit(session) == []


async def test_a_verifier_submits_only_their_own_draft_but_an_editor_may_submit_any(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    verifier, editor = demo_users[Role.verifier], demo_users[Role.editor]
    others = await a_listing(session, ListingStatus.draft, editor)
    await add_check(session, others, editor, CheckMethod.call, CheckResult.passed)
    await add_check(session, others, editor, CheckMethod.visit, CheckResult.passed)
    assert (await move(client, verifier, others, "submit")).status_code == 403
    assert (await move(client, editor, others, "submit")).status_code == 200


@pytest.mark.parametrize("status", [s for s in ListingStatus if s is not ListingStatus.draft])
async def test_submit_only_works_on_a_draft(
    client: AsyncClient,
    session: AsyncSession,
    demo_users: dict[Role, User],
    clock: None,
    status: ListingStatus,
) -> None:
    editor = demo_users[Role.editor]
    listing = await a_listing(session, status, editor)
    await add_check(session, listing, editor, CheckMethod.call, CheckResult.passed)
    await add_check(session, listing, editor, CheckMethod.visit, CheckResult.passed)
    assert (await move(client, editor, listing, "submit")).status_code == 400


# --- publish ---


@pytest.mark.parametrize("status", [ListingStatus.pending_review, ListingStatus.recheck_due])
async def test_publish_sets_the_dates_from_the_newest_passing_check_and_the_category_cycle(
    client: AsyncClient,
    session: AsyncSession,
    demo_users: dict[Role, User],
    clock: None,
    status: ListingStatus,
) -> None:
    editor = demo_users[Role.editor]
    category = await get_or_add_category(session, "pharmacy", "Pharmacy")
    category.recheck_days = 45
    session.add(category)
    listing = await a_listing(session, status)
    await add_check(session, listing, editor, CheckMethod.call, CheckResult.passed, days_ago=5)
    await add_check(session, listing, editor, CheckMethod.visit, CheckResult.passed, days_ago=2)
    await add_check(
        session, listing, editor, CheckMethod.call, CheckResult.failed, days_ago=0.5
    )  # newer, but a fail
    response = await move(client, editor, listing, "publish")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "published"
    assert body["last_verified_at"] == "2026-10-04T09:00:00Z"
    assert body["next_check_due"] == "2026-11-20T09:00:00Z"  # now + 45 days
    [entry] = await audit(session)
    assert (entry.user_id, entry.action, entry.old_value, entry.new_value) == (
        editor.id,
        "publish",
        status.value,
        "published",
    )


async def test_publish_uses_the_cycle_of_an_emergency_category(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    editor = demo_users[Role.editor]
    category = await get_or_add_category(session, "ambulance", "Ambulance")
    category.recheck_days = 14
    session.add(category)
    listing = await a_listing(session, ListingStatus.pending_review, category="ambulance")
    await add_check(session, listing, editor, CheckMethod.visit, CheckResult.passed)
    body = (await move(client, editor, listing, "publish")).json()
    assert body["next_check_due"] == "2026-10-20T09:00:00Z"


@pytest.mark.parametrize("days_ago", [15, 14.5])
async def test_publish_needs_a_passing_check_in_the_last_14_days(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None, days_ago: float
) -> None:
    editor = demo_users[Role.editor]
    listing = await a_listing(session, ListingStatus.pending_review)
    await add_check(session, listing, editor, CheckMethod.visit, CheckResult.passed, days_ago=days_ago)
    assert (await move(client, editor, listing, "publish")).status_code == 400
    await session.refresh(listing)
    assert listing.status == ListingStatus.pending_review


async def test_publish_accepts_a_check_just_inside_the_14_days(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    editor = demo_users[Role.editor]
    listing = await a_listing(session, ListingStatus.pending_review)
    await add_check(session, listing, editor, CheckMethod.call, CheckResult.passed, days_ago=13.9)
    assert (await move(client, editor, listing, "publish")).status_code == 200


@pytest.mark.parametrize("status", [ListingStatus.draft, ListingStatus.published, ListingStatus.hidden])
async def test_publish_only_works_from_pending_review_or_recheck_due(
    client: AsyncClient,
    session: AsyncSession,
    demo_users: dict[Role, User],
    clock: None,
    status: ListingStatus,
) -> None:
    editor = demo_users[Role.editor]
    listing = await a_listing(session, status)
    await add_check(session, listing, editor, CheckMethod.visit, CheckResult.passed)
    assert (await move(client, editor, listing, "publish")).status_code == 400


@pytest.mark.parametrize("role", [Role.verifier, Role.provider])
async def test_a_verifier_and_a_provider_cannot_publish_hide_or_reopen(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None, role: Role
) -> None:
    user = demo_users[role]
    listing = await a_listing(session, ListingStatus.pending_review, user)
    await add_check(session, listing, user, CheckMethod.visit, CheckResult.passed)
    assert (await move(client, user, listing, "publish")).status_code == 403
    assert (await move(client, user, listing, "hide", reason="Closed")).status_code == 403
    assert (await move(client, user, listing, "reopen")).status_code == 403
    await session.refresh(listing)
    assert listing.status == ListingStatus.pending_review


async def test_moves_need_a_login(client: AsyncClient, session: AsyncSession, clock: None) -> None:
    listing = await a_listing(session, ListingStatus.pending_review)
    for action in ("submit", "publish", "hide", "reopen"):
        assert (await client.post(f"/listings/{listing.id}/{action}")).status_code == 401


async def test_a_move_on_an_unknown_listing_is_404(
    client: AsyncClient, demo_users: dict[Role, User], clock: None
) -> None:
    for action in ("submit", "publish", "hide", "reopen"):
        response = await client.post(
            f"/listings/99999/{action}", json={"reason": "x"}, headers=bearer_for(demo_users[Role.editor])
        )
        assert response.status_code == 404, action


# --- hide and reopen ---


@pytest.mark.parametrize("status", [s for s in ListingStatus if s is not ListingStatus.hidden])
@pytest.mark.parametrize("role", [Role.editor, Role.admin])
async def test_hide_works_from_any_other_status_and_keeps_the_reason_in_the_audit_reference(
    client: AsyncClient,
    session: AsyncSession,
    demo_users: dict[Role, User],
    clock: None,
    status: ListingStatus,
    role: Role,
) -> None:
    listing = await a_listing(session, status)
    response = await move(client, demo_users[role], listing, "hide", reason="  Facility closed ")
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "hidden"
    [entry] = await audit(session)
    assert (entry.action, entry.field_changed, entry.old_value, entry.new_value, entry.reference) == (
        "hide",
        "status",
        status.value,
        "hidden",
        "Facility closed",
    )


@pytest.mark.parametrize("body", [{}, {"reason": ""}, {"reason": "   "}, {"reason": "x" * 201}])
async def test_hide_needs_a_reason_of_1_to_200_characters(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None, body: dict
) -> None:
    listing = await a_listing(session, ListingStatus.published)
    response = await client.post(
        f"/listings/{listing.id}/hide", json=body, headers=bearer_for(demo_users[Role.editor])
    )
    assert response.status_code == 422
    await session.refresh(listing)
    assert listing.status == ListingStatus.published


async def test_hiding_a_hidden_listing_is_400(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    listing = await a_listing(session, ListingStatus.hidden)
    assert (await move(client, demo_users[Role.editor], listing, "hide", reason="Again")).status_code == 400


async def test_a_hidden_listing_is_not_public_and_reopen_returns_it_to_draft(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    editor = demo_users[Role.editor]
    listing = await a_listing(session, ListingStatus.published)
    await move(client, editor, listing, "hide", reason="Closed")
    assert (await client.get(f"/listings/{listing.slug}")).status_code == 404
    response = await move(client, editor, listing, "reopen")
    assert response.status_code == 200
    assert response.json()["status"] == "draft"
    entries = await audit(session)
    assert [(entry.action, entry.old_value, entry.new_value) for entry in entries] == [
        ("hide", "published", "hidden"),
        ("reopen", "hidden", "draft"),
    ]


@pytest.mark.parametrize("status", [s for s in ListingStatus if s is not ListingStatus.hidden])
async def test_reopen_only_works_on_a_hidden_listing(
    client: AsyncClient,
    session: AsyncSession,
    demo_users: dict[Role, User],
    clock: None,
    status: ListingStatus,
) -> None:
    listing = await a_listing(session, status)
    assert (await move(client, demo_users[Role.editor], listing, "reopen")).status_code == 400


async def test_the_whole_road_from_draft_to_public_and_the_listing_then_appears_in_search(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    verifier, editor = demo_users[Role.verifier], demo_users[Role.editor]
    listing = await a_listing(session, ListingStatus.draft, verifier)
    for method in ("call", "visit"):
        response = await client.post(
            f"/listings/{listing.id}/checks",
            json={"method": method, "result": "pass"},
            headers=bearer_for(verifier),
        )
        assert response.status_code == 201
    assert (await move(client, verifier, listing, "submit")).status_code == 200
    assert (await move(client, verifier, listing, "publish")).status_code == 403
    assert (await move(client, editor, listing, "publish")).status_code == 200
    assert [item["slug"] for item in (await client.get("/search")).json()["items"]] == [listing.slug]
