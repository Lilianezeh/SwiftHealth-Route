"""POST /facility-submissions, the old anonymous "List your facility" form.
Requirements: FR-37, FR-51, NFR-07.
Contract: specs/backend/api-spec.md, "POST /facility-submissions" and section 7, "Phase 7"; decision D14 of
specs/2026-10-23-accounts-and-facility-ownership/.

Since accounts phase 7 the route always answers 401 and writes nothing: a facility is registered through
`POST /provider/facilities` (tests in `test_register_and_claim.py`). These tests replace the ones of the open
form, which are gone on purpose. Drafts that were sent before are not touched (the last test).
"""

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import AuditEntry, FacilityOwner, Listing, PhoneNumber
from app.models.base import ListingStatus
from tests.factories import add_listing, get_or_add_category

pytestmark = pytest.mark.anyio

OLD_FORM_BODY = {
    "facility_name": "Example Clinic",
    "category": "clinic",
    "area": "Trans-Ekulu",
    "address": "4 Example Street",
    "phone": "08030000000",
    "contact_name": "Dr. Example",
    "contact_email": "owner@example.com",
    "notes": "Open 24 hours",
}
SIGN_UP_FIRST = "Sign up or log in to list your facility."


async def test_the_old_form_answers_401_with_the_sentence_that_points_to_sign_up(client: AsyncClient) -> None:
    response = await client.post("/facility-submissions", json=OLD_FORM_BODY)
    assert response.status_code == 401
    assert response.json() == {"detail": SIGN_UP_FIRST}


async def test_the_old_form_writes_nothing(client: AsyncClient, session: AsyncSession) -> None:
    await get_or_add_category(session, "clinic", "Clinic")
    await session.commit()
    await client.post("/facility-submissions", json=OLD_FORM_BODY)
    for table in (Listing, PhoneNumber, AuditEntry, FacilityOwner):
        assert (await session.exec(select(table))).all() == []


@pytest.mark.parametrize("body", [{}, {"facility_name": "x"}, None])
async def test_the_answer_is_401_whatever_the_body_is(client: AsyncClient, body: dict | None) -> None:
    response = await client.post("/facility-submissions", json=body)
    assert response.status_code == 401


async def test_a_bearer_token_does_not_change_the_answer(client: AsyncClient) -> None:
    response = await client.post(
        "/facility-submissions", json=OLD_FORM_BODY, headers={"Authorization": "Bearer not-a-real-token"}
    )
    assert response.status_code == 401


async def test_a_draft_sent_before_stays_as_it_is(client: AsyncClient, session: AsyncSession) -> None:
    draft = await add_listing(session, "Old Draft Clinic", category_slug="clinic", status=ListingStatus.draft)
    await session.commit()
    await client.post("/facility-submissions", json=OLD_FORM_BODY)
    stored = (await session.exec(select(Listing))).all()
    assert [(listing.id, listing.status, listing.created_by, listing.owner_id) for listing in stored] == [
        (draft.id, ListingStatus.draft, None, None)
    ]
