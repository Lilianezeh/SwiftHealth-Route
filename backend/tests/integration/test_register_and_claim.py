"""Register a new facility or claim an existing one. Requirements: FR-50, FR-51, US-17, NFR-06, NFR-07.
Spec: specs/backend/api-spec.md section 7, "Phase 7"; decisions D14 and D15 of
specs/2026-10-23-accounts-and-facility-ownership/.

A provider asks for an owner link in one of two ways; both leave a `pending` link that staff decide.
Every name, address and number here is fictional.
"""

from collections.abc import Iterator
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment
from app.core.config import DEFAULT_MAP_CENTRE
from app.main import app
from app.models import AuditEntry, FacilityOwner, Listing, PhoneNumber, User
from app.models.base import ListingStatus, Role
from tests.factories import add_listing, add_owner_link, get_or_add_category
from tests.staff_helpers import bearer_for

pytestmark = pytest.mark.anyio

NOW = datetime(2026, 10, 27, 9, 0, tzinfo=timezone.utc)
THANKS = "Thanks. Pay the first month and our team will verify your facility before it is listed."
CLAIM_THANKS = "Thanks. Pay the first month and our team will phone the facility to check."
BODY = {
    "facility_name": "Example Clinic",
    "category": "clinic",
    "area": "Trans-Ekulu",
    "address": "4 Example Street",
    "phone": "08030000000",
}
ALREADY_LISTED = "A facility like this is already listed. You can ask to manage it instead."
ALREADY_REGISTERED = "This facility is already registered. Please contact us."


@pytest.fixture
def clock() -> Iterator[None]:
    app.dependency_overrides[get_current_moment] = lambda: NOW
    yield
    app.dependency_overrides.pop(get_current_moment, None)


@pytest.fixture
async def categories(session: AsyncSession) -> None:
    await get_or_add_category(session, "clinic", "Clinic")
    ambulance = await get_or_add_category(session, "ambulance", "Ambulance")
    ambulance.is_emergency = True
    session.add(ambulance)
    await session.commit()


@pytest.fixture
def provider(demo_users: dict[Role, User]) -> User:
    return demo_users[Role.provider]


async def register(client: AsyncClient, user: User | None, ip: str = "203.0.113.5", **changes: object):
    return await client.post(
        "/provider/facilities",
        json={**BODY, **changes},
        headers={**(bearer_for(user) if user else {}), "x-forwarded-for": ip},
    )


async def claim(client: AsyncClient, user: User | None, listing_id: int, ip: str = "203.0.113.6", **changes):
    body = {"listing_id": listing_id, "reason": "I run the front desk.", **changes}
    return await client.post(
        "/provider/claims",
        json=body,
        headers={**(bearer_for(user) if user else {}), "x-forwarded-for": ip},
    )


async def search_claimable(client: AsyncClient, user: User | None, text: str, ip: str = "203.0.113.7"):
    return await client.get(
        "/provider/claimable",
        params={"q": text},
        headers={**(bearer_for(user) if user else {}), "x-forwarded-for": ip},
    )


async def first_month_paid(session: AsyncSession) -> None:
    """What the signed Paystack webhook does to a request (see test_owner_fee_payment.py): the link
    is `pending` for staff and paid for a month. Staff see a request only after this."""
    for link in await links_of(session):
        link.status, link.paid_until = "pending", NOW + timedelta(days=30)
    await session.commit()


async def links_of(session: AsyncSession) -> list[FacilityOwner]:
    return list((await session.exec(select(FacilityOwner).order_by(FacilityOwner.id))).all())


# ---------- who may use the routes ----------


async def test_anonymous_calls_to_all_three_routes_are_401(
    client: AsyncClient, clock: None, categories: None, session: AsyncSession
) -> None:
    listing = await add_listing(session, "Eze Clinic", category_slug="clinic")
    await session.commit()
    assert (await register(client, None)).status_code == 401
    assert (await claim(client, None, listing.id)).status_code == 401
    assert (await search_claimable(client, None, "eze")).status_code == 401


@pytest.mark.parametrize("role", [Role.verifier, Role.editor, Role.admin])
async def test_a_staff_account_is_403_on_all_three_routes(
    client: AsyncClient, clock: None, categories: None, session: AsyncSession,
    demo_users: dict[Role, User], role: Role,
) -> None:
    listing = await add_listing(session, "Eze Clinic", category_slug="clinic")
    await session.commit()
    staff = demo_users[role]
    assert (await register(client, staff)).status_code == 403
    assert (await claim(client, staff, listing.id)).status_code == 403
    assert (await search_claimable(client, staff, "eze")).status_code == 403
    assert await links_of(session) == []


# ---------- register ----------


async def test_a_registration_makes_a_draft_and_an_owner_link_that_waits_for_the_first_payment(
    client: AsyncClient, session: AsyncSession, clock: None, categories: None, provider: User
) -> None:
    response = await register(client, provider)
    assert response.status_code == 201, response.text
    [listing] = (await session.exec(select(Listing))).all()
    [link] = await links_of(session)
    assert response.json() == {
        "message": THANKS, "listing_id": listing.id, "link_id": link.id,
        "status": "awaiting_payment", "fee_naira": "10000.00",
    }
    assert listing.status == ListingStatus.draft
    assert listing.created_by is None and listing.owner_id is None
    assert (listing.name, listing.area, listing.address) == (
        "Example Clinic", "Trans-Ekulu", "4 Example Street",
    )
    assert (listing.latitude, listing.longitude) == DEFAULT_MAP_CENTRE
    assert listing.slug == "example-clinic-trans-ekulu"
    assert (link.listing_id, link.user_id, link.role, link.status) == (
        listing.id, provider.id, "owner", "awaiting_payment",
    )
    assert link.requested_at == NOW and link.paid_until is None


async def test_the_phone_is_stored_as_the_primary_number_in_plus_234(
    client: AsyncClient, session: AsyncSession, clock: None, categories: None, provider: User
) -> None:
    await register(client, provider, phone="0803 000 0000")
    [phone] = (await session.exec(select(PhoneNumber))).all()
    assert (phone.number, phone.is_primary, phone.is_whatsapp) == ("+2348030000000", True, False)


async def test_a_manager_role_and_notes_are_kept_in_the_link(
    client: AsyncClient, session: AsyncSession, clock: None, categories: None, provider: User
) -> None:
    await register(client, provider, role="manager", notes="  Open 24 hours  ")
    [link] = await links_of(session)
    assert (link.role, link.note) == ("manager", "Open 24 hours")


async def test_the_notes_are_optional_and_never_become_the_description(
    client: AsyncClient, session: AsyncSession, clock: None, categories: None, provider: User
) -> None:
    await register(client, provider, notes="Call after 5 pm")
    [listing] = (await session.exec(select(Listing))).all()
    assert listing.description is None


async def test_it_writes_a_create_row_and_an_owner_request_row_for_the_provider(
    client: AsyncClient, session: AsyncSession, clock: None, categories: None, provider: User
) -> None:
    await register(client, provider, notes="Call after 5 pm")
    [listing] = (await session.exec(select(Listing))).all()
    entries = (await session.exec(select(AuditEntry).order_by(AuditEntry.id))).all()
    assert [(entry.action, entry.user_id, entry.listing_id) for entry in entries] == [
        ("create", provider.id, listing.id),
        ("owner_request", provider.id, listing.id),
    ]
    request_entry = entries[1]
    assert request_entry.reference == f"user:{provider.id}"
    assert (request_entry.field_changed, request_entry.new_value) == ("status", "awaiting_payment")
    written = " ".join(str(entry.model_dump()) for entry in entries)
    assert "Call after 5 pm" not in written and "+2348030000000" not in written


async def test_the_draft_is_not_public_and_the_contact_comes_from_the_account(
    client: AsyncClient, session: AsyncSession, clock: None, categories: None, provider: User
) -> None:
    await register(client, provider)
    assert (await client.get("/search")).json()["total"] == 0
    assert (await client.get("/listings/example-clinic-trans-ekulu")).status_code == 404
    for path in ("/search", "/meta", "/emergency"):
        assert provider.email not in (await client.get(path)).text, path


@pytest.mark.parametrize(
    "changes",
    [
        {"category": "ambulance"},
        {"category": "no-such-category"},
        {"area": "Atlantis"},
        {"facility_name": "A"},
        {"facility_name": "x" * 121},
        {"address": "ab"},
        {"phone": ""},
        {"phone": "12345"},
        {"role": "boss"},
        {"notes": "x" * 301},
    ],
)
async def test_bad_input_is_422_and_nothing_is_stored(
    client: AsyncClient, session: AsyncSession, clock: None, categories: None, provider: User,
    changes: dict,
) -> None:
    response = await register(client, provider, **changes)
    assert response.status_code == 422, response.text
    assert (await session.exec(select(Listing))).all() == []
    assert await links_of(session) == []


async def test_the_fourth_registration_from_one_address_is_429(
    client: AsyncClient, session: AsyncSession, clock: None, categories: None, provider: User
) -> None:
    for number in range(3):
        response = await register(client, provider, facility_name=f"Unique Place {number}x{number * 7}",
                                  phone=f"0803000100{number}", address=f"{number + 1} Other Road",
                                  area=["GRA", "Ogui", "Independence Layout"][number])
        assert response.status_code == 201, response.text
    response = await register(client, provider, facility_name="Another Place Entirely", phone="08030001999")
    assert response.status_code == 429
    assert (await register(client, provider, ip="203.0.113.99", facility_name="Another Place Entirely",
                           phone="08030001999")).status_code == 201


# ---------- the duplicate check (D15) ----------


async def test_the_same_phone_on_a_published_listing_is_409_with_its_id(
    client: AsyncClient, session: AsyncSession, clock: None, categories: None, provider: User
) -> None:
    existing = await add_listing(session, "Totally Different Name", category_slug="clinic",
                                 phone="+2348030000000", area="Ogui")
    await session.commit()
    response = await register(client, provider)
    assert response.status_code == 409
    assert response.json()["detail"] == {"message": ALREADY_LISTED, "listing_id": existing.id}
    assert len((await session.exec(select(Listing))).all()) == 1
    assert await links_of(session) == []
    assert (await session.exec(select(AuditEntry))).all() == []


async def test_a_similar_name_in_the_same_area_is_409(
    client: AsyncClient, session: AsyncSession, clock: None, categories: None, provider: User
) -> None:
    existing = await add_listing(session, "Example Clinic Ltd", category_slug="clinic",
                                 area="Trans-Ekulu", phone="+2348039999999")
    await session.commit()
    response = await register(client, provider, facility_name="Example Clinic")
    assert response.status_code == 409
    assert response.json()["detail"]["listing_id"] == existing.id


async def test_the_same_name_in_another_area_is_not_a_duplicate(
    client: AsyncClient, session: AsyncSession, clock: None, categories: None, provider: User
) -> None:
    await add_listing(session, "Example Clinic", category_slug="clinic", area="Ogui", phone="+2348039999999")
    await session.commit()
    assert (await register(client, provider)).status_code == 201


async def test_a_clearly_different_name_in_the_same_area_is_not_a_duplicate(
    client: AsyncClient, session: AsyncSession, clock: None, categories: None, provider: User
) -> None:
    await add_listing(session, "Sunrise Maternity Home", category_slug="clinic",
                      area="Trans-Ekulu", phone="+2348039999999")
    await session.commit()
    assert (await register(client, provider)).status_code == 201


async def test_a_recheck_due_listing_is_offered_for_claiming(
    client: AsyncClient, session: AsyncSession, clock: None, categories: None, provider: User
) -> None:
    existing = await add_listing(session, "Lapsed Clinic", category_slug="clinic", phone="+2348030000000",
                                 status=ListingStatus.recheck_due)
    await session.commit()
    response = await register(client, provider)
    assert response.status_code == 409
    assert response.json()["detail"]["listing_id"] == existing.id


@pytest.mark.parametrize("status", [ListingStatus.draft, ListingStatus.hidden])
async def test_a_draft_or_hidden_duplicate_gets_the_generic_message_and_no_id(
    client: AsyncClient, session: AsyncSession, clock: None, categories: None, provider: User,
    status: ListingStatus,
) -> None:
    await add_listing(session, "Hidden Clinic", category_slug="clinic", phone="+2348030000000", status=status)
    await session.commit()
    response = await register(client, provider)
    assert response.status_code == 409
    assert response.json()["detail"] == {"message": ALREADY_REGISTERED, "listing_id": None}
    assert "Hidden Clinic" not in response.text


# ---------- the claim search ----------


async def test_the_claim_search_finds_published_and_recheck_due_listings_only(
    client: AsyncClient, session: AsyncSession, clock: None, categories: None, provider: User
) -> None:
    published = await add_listing(session, "Grace Clinic", category_slug="clinic")
    lapsed = await add_listing(session, "Grace Clinic Annex", category_slug="clinic",
                               status=ListingStatus.recheck_due)
    await add_listing(session, "Grace Clinic Draft", category_slug="clinic", status=ListingStatus.draft)
    await add_listing(session, "Grace Clinic Hidden", category_slug="clinic", status=ListingStatus.hidden)
    await session.commit()
    response = await search_claimable(client, provider, "Grace Clinic")
    assert response.status_code == 200, response.text
    assert {item["id"] for item in response.json()["items"]} == {published.id, lapsed.id}
    assert response.json()["items"][0]["name"] == "Grace Clinic"


async def test_the_claim_search_returns_only_name_area_and_category(
    client: AsyncClient, session: AsyncSession, clock: None, categories: None, provider: User
) -> None:
    await add_listing(session, "Grace Clinic", category_slug="clinic", phone="+2348031112222")
    await session.commit()
    response = await search_claimable(client, provider, "Grace")
    [item] = response.json()["items"]
    assert set(item) == {"id", "name", "area", "category"}
    assert item["category"] == {"slug": "clinic", "name": "Clinic"}
    assert "+234" not in response.text and "Example Road" not in response.text


async def test_the_claim_search_finds_a_misspelt_name(
    client: AsyncClient, session: AsyncSession, clock: None, categories: None, provider: User
) -> None:
    await add_listing(session, "Grace Clinic", category_slug="clinic")
    await session.commit()
    assert len((await search_claimable(client, provider, "Grase Clinic")).json()["items"]) == 1


async def test_the_claim_search_gives_at_most_ten_results(
    client: AsyncClient, session: AsyncSession, clock: None, categories: None, provider: User
) -> None:
    for number in range(12):
        await add_listing(session, f"Grace Clinic {number}", category_slug="clinic")
    await session.commit()
    assert len((await search_claimable(client, provider, "Grace Clinic")).json()["items"]) == 10


@pytest.mark.parametrize("text", ["", "a", "x" * 101])
async def test_a_claim_search_text_of_the_wrong_length_is_422(
    client: AsyncClient, clock: None, provider: User, text: str
) -> None:
    assert (await search_claimable(client, provider, text)).status_code == 422


async def test_the_61st_claim_search_from_one_address_in_an_hour_is_429(
    client: AsyncClient, clock: None, provider: User
) -> None:
    for _ in range(60):
        assert (await search_claimable(client, provider, "grace")).status_code == 200
    assert (await search_claimable(client, provider, "grace")).status_code == 429


# ---------- claim ----------


async def test_a_claim_makes_a_link_that_waits_for_payment_and_an_audit_row(
    client: AsyncClient, session: AsyncSession, clock: None, categories: None, provider: User
) -> None:
    listing = await add_listing(session, "Eze Clinic", category_slug="clinic")
    await session.commit()
    response = await claim(client, provider, listing.id, role="manager")
    assert response.status_code == 201, response.text
    [link] = await links_of(session)
    assert response.json() == {
        "message": CLAIM_THANKS, "link_id": link.id, "status": "awaiting_payment", "fee_naira": "10000.00",
    }
    assert (link.listing_id, link.user_id, link.role, link.status) == (
        listing.id, provider.id, "manager", "awaiting_payment",
    )
    assert link.note == "I run the front desk."
    [entry] = (await session.exec(select(AuditEntry))).all()
    assert (entry.action, entry.user_id, entry.listing_id) == ("owner_request", provider.id, listing.id)
    assert entry.reference == f"user:{provider.id}"
    assert "front desk" not in str(entry.model_dump())


async def test_the_role_of_a_claim_defaults_to_owner(
    client: AsyncClient, session: AsyncSession, clock: None, categories: None, provider: User
) -> None:
    listing = await add_listing(session, "Eze Clinic", category_slug="clinic")
    await session.commit()
    await claim(client, provider, listing.id)
    assert (await links_of(session))[0].role == "owner"


async def test_a_pending_claim_gives_no_access_until_staff_approve(
    client: AsyncClient, session: AsyncSession, clock: None, categories: None, provider: User
) -> None:
    listing = await add_listing(session, "Eze Clinic", category_slug="clinic")
    await session.commit()
    await claim(client, provider, listing.id)
    own = await client.get(f"/provider/listings/{listing.id}", headers=bearer_for(provider))
    assert own.status_code == 404


@pytest.mark.parametrize("status", [ListingStatus.draft, ListingStatus.hidden])
async def test_a_claim_on_a_draft_or_hidden_listing_is_404(
    client: AsyncClient, session: AsyncSession, clock: None, categories: None, provider: User,
    status: ListingStatus,
) -> None:
    listing = await add_listing(session, "Eze Clinic", category_slug="clinic", status=status)
    await session.commit()
    assert (await claim(client, provider, listing.id)).status_code == 404
    assert await links_of(session) == []


async def test_a_claim_on_an_unknown_listing_is_404(
    client: AsyncClient, clock: None, provider: User
) -> None:
    assert (await claim(client, provider, 999999)).status_code == 404


async def test_a_recheck_due_listing_can_be_claimed(
    client: AsyncClient, session: AsyncSession, clock: None, categories: None, provider: User
) -> None:
    listing = await add_listing(session, "Eze Clinic", category_slug="clinic",
                                status=ListingStatus.recheck_due)
    await session.commit()
    assert (await claim(client, provider, listing.id)).status_code == 201


async def test_a_claim_for_a_facility_already_managed_is_409(
    client: AsyncClient, session: AsyncSession, clock: None, categories: None, provider: User
) -> None:
    listing = await add_listing(session, "Eze Clinic", category_slug="clinic")
    await add_owner_link(session, listing, provider)
    await session.commit()
    response = await claim(client, provider, listing.id)
    assert response.status_code == 409
    assert response.json()["detail"] == "You already manage this facility."


async def test_a_second_claim_while_the_first_is_unpaid_gives_back_the_same_request_without_a_new_row(
    client: AsyncClient, session: AsyncSession, clock: None, categories: None, provider: User
) -> None:
    listing = await add_listing(session, "Eze Clinic", category_slug="clinic")
    await session.commit()
    first = await claim(client, provider, listing.id)
    second = await claim(client, provider, listing.id)
    assert second.status_code == 201
    assert second.json()["link_id"] == first.json()["link_id"]
    assert second.json()["status"] == "awaiting_payment"
    assert len(await links_of(session)) == 1
    assert len((await session.exec(select(AuditEntry))).all()) == 1


async def test_a_second_claim_while_the_first_waits_for_staff_is_409(
    client: AsyncClient, session: AsyncSession, clock: None, categories: None, provider: User
) -> None:
    listing = await add_listing(session, "Eze Clinic", category_slug="clinic")
    await add_owner_link(session, listing, provider, status="pending")  # the first month is paid
    await session.commit()
    response = await claim(client, provider, listing.id)
    assert response.status_code == 409
    assert response.json()["detail"] == "Your request for this facility is waiting for our team."
    assert len(await links_of(session)) == 1


@pytest.mark.parametrize("status", ["lapsed", "ending"])
async def test_a_claim_on_a_facility_whose_fee_lapsed_or_was_cancelled_says_you_already_manage_it(
    client: AsyncClient, session: AsyncSession, clock: None, categories: None, provider: User, status: str
) -> None:
    listing = await add_listing(session, "Eze Clinic", category_slug="clinic")
    await add_owner_link(session, listing, provider, status=status)
    await session.commit()
    response = await claim(client, provider, listing.id)
    assert response.status_code == 409
    assert response.json()["detail"] == "You already manage this facility."


async def test_a_removed_link_goes_back_to_waiting_for_payment_on_the_same_row(
    client: AsyncClient, session: AsyncSession, clock: None, categories: None, provider: User
) -> None:
    listing = await add_listing(session, "Eze Clinic", category_slug="clinic")
    old = await add_owner_link(session, listing, provider, status="removed")
    await session.commit()
    response = await claim(client, provider, listing.id, role="manager", reason="Back again, new manager.")
    assert response.status_code == 201
    [link] = await links_of(session)
    assert link.id == old.id
    assert (link.status, link.role, link.note, link.requested_at) == (
        "awaiting_payment", "manager", "Back again, new manager.", NOW,
    )


async def test_a_listing_with_an_approved_owner_still_gets_a_request_that_waits_for_payment(
    client: AsyncClient, session: AsyncSession, clock: None, categories: None, provider: User,
    demo_users: dict[Role, User],
) -> None:
    listing = await add_listing(session, "Eze Clinic", category_slug="clinic")
    other_owner = demo_users[Role.verifier]  # any user row will do for the existing approved link
    await add_owner_link(session, listing, other_owner)
    await session.commit()
    assert (await claim(client, provider, listing.id)).status_code == 201
    statuses = sorted(link.status for link in await links_of(session))
    assert statuses == ["approved", "awaiting_payment"]


@pytest.mark.parametrize(
    "changes", [{"reason": ""}, {"reason": "ab"}, {"reason": "x" * 301}, {"role": "boss"}]
)
async def test_a_bad_claim_is_422(
    client: AsyncClient, session: AsyncSession, clock: None, categories: None, provider: User,
    changes: dict,
) -> None:
    listing = await add_listing(session, "Eze Clinic", category_slug="clinic")
    await session.commit()
    assert (await claim(client, provider, listing.id, **changes)).status_code == 422
    assert await links_of(session) == []


async def test_the_eleventh_claim_from_one_address_in_a_day_is_429(
    client: AsyncClient, session: AsyncSession, clock: None, categories: None, provider: User
) -> None:
    listings = [await add_listing(session, f"Place {number}", category_slug="clinic") for number in range(11)]
    await session.commit()
    for listing in listings[:10]:
        assert (await claim(client, provider, listing.id)).status_code == 201
    assert (await claim(client, provider, listings[10].id)).status_code == 429


# ---------- the staff queue shows the reason ----------


async def test_the_owner_requests_queue_shows_the_reason_and_a_decision_replaces_it(
    client: AsyncClient, session: AsyncSession, clock: None, categories: None, provider: User,
    demo_users: dict[Role, User],
) -> None:
    listing = await add_listing(session, "Eze Clinic", category_slug="clinic")
    await session.commit()
    await claim(client, provider, listing.id)
    editor = bearer_for(demo_users[Role.editor])
    unpaid = await client.get("/staff/owner-requests", headers=editor)
    assert unpaid.json()["items"] == []  # staff see nothing before the first payment
    await first_month_paid(session)
    [item] = (await client.get("/staff/owner-requests", headers=editor)).json()["items"]
    assert item["reason"] == "I run the front desk."
    approved = await client.post(
        f"/staff/owner-requests/{item['id']}/approve", json={"note": "Spoke to the matron."}, headers=editor
    )
    assert approved.status_code == 200
    assert approved.json()["note"] == "Spoke to the matron."


async def test_a_registered_facility_shows_up_in_the_queue_with_the_phone_to_call(
    client: AsyncClient, session: AsyncSession, clock: None, categories: None, provider: User,
    demo_users: dict[Role, User],
) -> None:
    await register(client, provider, notes="Call after 5 pm")
    await first_month_paid(session)
    editor = bearer_for(demo_users[Role.editor])
    [item] = (await client.get("/staff/owner-requests", headers=editor)).json()["items"]
    assert item["reason"] == "Call after 5 pm"
    assert item["listing"]["name"] == "Example Clinic"
    assert [phone["number"] for phone in item["listing"]["phones"]] == ["+2348030000000"]
