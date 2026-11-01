"""The full facility owner form: more fields, "Save as draft", editing a request, and the owner's statuses.
Requirements: US-17, FR-50, FR-23, FR-31, NFR-06, NFR-07.
Spec: specs/2026-11-01-owner-form-fields/ and specs/backend/api-spec.md section 7
("The full owner form and drafts").

A draft is a request the owner has not sent: no payment is asked and staff see nothing. The owner's email
is for staff only. Paystack and Resend are replaced by recorders; every name, number and address is fictional.
"""

from collections.abc import Iterator
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment
from app.core.config import settings
from app.integrations import paystack, resend
from app.main import app
from app.models import AuditEntry, FacilityOwner, Listing, OpeningHours, PhoneNumber, Service, User
from app.models.base import ListingStatus, Role
from app.repositories import user_repository
from tests.factories import add_listing, add_owner_link, get_or_add_category
from tests.staff_helpers import bearer_for

pytestmark = pytest.mark.anyio

NOW = datetime(2026, 11, 1, 9, 0, tzinfo=timezone.utc)
FULL_FORM = {
    "facility_name": "Example Clinic",
    "category": "clinic",
    "area": "Trans-Ekulu",
    "address": "4 Example Street",
    "landmark": "Behind the example market",
    "description": "A small clinic for families.",
    "email": "front-desk@clinic.example.com",
    "phone": "08030000000",
    "phone_has_whatsapp": True,
    "other_phones": [{"number": "08030000001", "label": "Pharmacy desk", "is_whatsapp": False}],
    "is_24_hours": False,
    "opening_hours": [
        {"day_of_week": 0, "opens_at": "08:00", "closes_at": "17:00", "is_closed": False},
        {"day_of_week": 6, "is_closed": True},
    ],
    "services": ["Malaria test", "Consultation"],
}


@pytest.fixture
def clock() -> Iterator[None]:
    app.dependency_overrides[get_current_moment] = lambda: NOW
    yield
    app.dependency_overrides.pop(get_current_moment, None)


@pytest.fixture(autouse=True)
async def categories(session: AsyncSession) -> None:
    await get_or_add_category(session, "clinic", "Clinic")
    await session.commit()


@pytest.fixture
def provider(demo_users: dict[Role, User]) -> User:
    return demo_users[Role.provider]


@pytest.fixture
async def stranger(session: AsyncSession, demo_password_hash: str) -> User:
    user = await user_repository.create(
        session,
        name="Other Provider",
        email="other-owner@demo.example.com",
        phone="+2340000000778",
        password_hash=demo_password_hash,
        role=Role.provider,
    )
    await session.commit()
    return user


class Recorder:
    def __init__(self) -> None:
        self.refunds: list[str] = []

    async def create_refund(self, *, reference: str, **_: object) -> None:
        self.refunds.append(reference)

    async def send_email(self, *_: object, **__: object) -> None:
        return None


@pytest.fixture
def recorder(monkeypatch: pytest.MonkeyPatch) -> Recorder:
    made = Recorder()
    monkeypatch.setattr(settings, "paystack_secret_key", "sk_test_not_a_real_key")
    monkeypatch.setattr(paystack, "create_refund", made.create_refund)
    monkeypatch.setattr(resend, "send_email", made.send_email)
    return made


async def register(client: AsyncClient, user: User, **changes: object):
    return await client.post(
        "/provider/facilities",
        json={**FULL_FORM, **changes},
        headers={**bearer_for(user), "x-forwarded-for": "203.0.113.20"},
    )


async def save_request(client: AsyncClient, user: User, link_id: int, **changes: object):
    return await client.put(
        f"/provider/requests/{link_id}", json={**FULL_FORM, **changes}, headers=bearer_for(user)
    )


async def read_request(client: AsyncClient, user: User, link_id: int):
    return await client.get(f"/provider/requests/{link_id}", headers=bearer_for(user))


async def the_link(session: AsyncSession, link_id: int) -> FacilityOwner:
    link = await session.get(FacilityOwner, link_id, populate_existing=True)  # as the database holds it now
    assert link is not None
    return link


async def the_listing(session: AsyncSession, listing_id: int) -> Listing:
    listing = await session.get(Listing, listing_id, populate_existing=True)
    assert listing is not None
    return listing


# ---------- registering with the full form ----------


async def test_a_sent_request_keeps_every_field_of_the_form(
    client: AsyncClient, session: AsyncSession, provider: User, clock: None
) -> None:
    response = await register(client, provider)

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "awaiting_payment" and body["fee_naira"] == "10000.00"
    listing = await the_listing(session, body["listing_id"])
    assert listing.status == ListingStatus.draft
    assert (listing.landmark, listing.description) == (
        "Behind the example market",
        "A small clinic for families.",
    )
    assert listing.email == "front-desk@clinic.example.com"
    assert listing.is_24_hours is False
    phones = (
        await session.exec(
            select(PhoneNumber).where(PhoneNumber.listing_id == listing.id).order_by(PhoneNumber.id)
        )
    ).all()
    assert [(p.number, p.is_primary, p.is_whatsapp, p.label) for p in phones] == [
        ("+2348030000000", True, True, None),
        ("+2348030000001", False, False, "Pharmacy desk"),
    ]
    hours = (await session.exec(select(OpeningHours).where(OpeningHours.listing_id == listing.id))).all()
    assert sorted((h.day_of_week, h.is_closed) for h in hours) == [(0, False), (6, True)]
    services = (await session.exec(select(Service).where(Service.listing_id == listing.id))).all()
    assert sorted(s.name for s in services) == ["Consultation", "Malaria test"]


async def test_the_old_short_form_still_works(client: AsyncClient, provider: User, clock: None) -> None:
    short = {
        "facility_name": "Short Clinic",
        "category": "clinic",
        "area": "Trans-Ekulu",
        "address": "9 Example Street",
        "phone": "08030000009",
    }

    response = await client.post(
        "/provider/facilities",
        json=short,
        headers={**bearer_for(provider), "x-forwarded-for": "203.0.113.21"},
    )

    assert response.status_code == 201
    assert response.json()["status"] == "awaiting_payment"


async def test_the_listing_changes_write_audit_entries(
    client: AsyncClient, session: AsyncSession, provider: User, clock: None
) -> None:
    body = (await register(client, provider)).json()

    entries = (
        await session.exec(select(AuditEntry).where(AuditEntry.listing_id == body["listing_id"]))
    ).all()

    assert {"create", "owner_request"} <= {entry.action for entry in entries}


@pytest.mark.parametrize(
    "changes",
    [
        {"description": "x" * 201},
        {"landmark": "x" * 201},
        {"email": "not-an-email"},
        {"other_phones": [{"number": "08030000000"}]},  # the main number again
        {"other_phones": [{"number": "08030000001"}, {"number": "08030000001"}]},
        {
            "other_phones": [{"number": "0803000000%d" % digit} for digit in range(1, 6)]
        },  # five, the limit is four
        {"other_phones": [{"number": "123"}]},
        {"services": ["Brain surgery on the moon"]},
        {"services": ["Consultation", "Consultation"]},
        {"opening_hours": [{"day_of_week": 1, "opens_at": "08:00"}]},  # an open day needs both times
        {"opening_hours": [{"day_of_week": 1, "is_closed": True}, {"day_of_week": 1, "is_closed": True}]},
        {"opening_hours": [{"day_of_week": 7, "is_closed": True}]},
    ],
)
async def test_a_bad_field_is_a_422_and_nothing_is_saved(
    client: AsyncClient, session: AsyncSession, provider: User, clock: None, changes: dict
) -> None:
    response = await register(client, provider, **changes)

    assert response.status_code == 422
    assert (await session.exec(select(Listing).where(Listing.name == "Example Clinic"))).first() is None


async def test_a_blank_description_and_email_mean_none(
    client: AsyncClient, session: AsyncSession, provider: User, clock: None
) -> None:
    body = (await register(client, provider, description="  ", email="  ", landmark=" ")).json()

    listing = await the_listing(session, body["listing_id"])
    assert (listing.description, listing.email, listing.landmark) == (None, None, None)


async def test_open_24_hours_ignores_the_daily_hours(
    client: AsyncClient, session: AsyncSession, provider: User, clock: None
) -> None:
    body = (await register(client, provider, is_24_hours=True)).json()

    listing = await the_listing(session, body["listing_id"])
    hours = (await session.exec(select(OpeningHours).where(OpeningHours.listing_id == listing.id))).all()
    assert listing.is_24_hours is True and hours == []


# ---------- Save as draft ----------


async def test_save_as_draft_makes_a_draft_link_and_asks_for_no_payment(
    client: AsyncClient, session: AsyncSession, provider: User, clock: None
) -> None:
    response = await register(client, provider, save_as_draft=True)

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "draft"
    assert (
        body["message"]
        == "Your draft is saved. Nothing is sent to our team and nothing is public until you send it."
    )
    assert (await the_link(session, body["link_id"])).status == "draft"
    assert (await the_listing(session, body["listing_id"])).status == ListingStatus.draft


async def test_staff_see_nothing_of_a_draft(
    client: AsyncClient, session: AsyncSession, provider: User, demo_users: dict[Role, User], clock: None
) -> None:
    await register(client, provider, save_as_draft=True)
    editor = demo_users[Role.editor]

    requests = await client.get("/staff/owner-requests", headers=bearer_for(editor))
    listings = await client.get("/listings", headers=bearer_for(editor), params={"status": "draft"})

    assert requests.json()["total"] == 0
    assert all(item["name"] != "Example Clinic" for item in listings.json()["items"])


async def test_a_draft_is_not_public_and_cannot_be_paid(
    client: AsyncClient, session: AsyncSession, provider: User, clock: None
) -> None:
    body = (await register(client, provider, save_as_draft=True)).json()

    public = await client.get(f"/listings/{(await the_listing(session, body['listing_id'])).slug}")
    paying = await client.post(
        "/payments/owner-fee", json={"link_id": body["link_id"]}, headers=bearer_for(provider)
    )

    assert public.status_code == 404
    assert paying.status_code == 409


async def test_a_draft_is_checked_for_duplicates_like_a_sent_request(
    client: AsyncClient, session: AsyncSession, provider: User, clock: None
) -> None:
    await register(client, provider, save_as_draft=True)

    second = await register(client, provider, facility_name="Another Name", save_as_draft=True)

    assert second.status_code == 409  # the same phone number


# ---------- reading and editing a request ----------


async def test_the_owner_reads_the_form_back_as_saved(
    client: AsyncClient, provider: User, clock: None
) -> None:
    saved = (await register(client, provider, save_as_draft=True)).json()

    response = await read_request(client, provider, saved["link_id"])

    assert response.status_code == 200
    form = response.json()
    assert (
        form["status"] == "draft"
        and form["link_id"] == saved["link_id"]
        and form["listing_id"] == saved["listing_id"]
    )
    for key in (
        "facility_name",
        "category",
        "area",
        "address",
        "landmark",
        "description",
        "email",
        "phone_has_whatsapp",
        "is_24_hours",
    ):
        assert form[key] == FULL_FORM[key], key
    assert form["phone"] == "+2348030000000"  # the numbers come back as stored
    assert form["other_phones"] == [
        {"number": "+2348030000001", "label": "Pharmacy desk", "is_whatsapp": False}
    ]
    assert sorted(form["services"]) == ["Consultation", "Malaria test"]
    assert {(row["day_of_week"], row["is_closed"]) for row in form["opening_hours"]} == {
        (0, False),
        (6, True),
    }


async def test_another_provider_cannot_read_or_change_a_request(
    client: AsyncClient, provider: User, stranger: User, clock: None
) -> None:
    saved = (await register(client, provider, save_as_draft=True)).json()

    assert (await read_request(client, stranger, saved["link_id"])).status_code == 404
    assert (await save_request(client, stranger, saved["link_id"])).status_code == 404
    unknown = await read_request(client, provider, saved["link_id"] + 999)
    assert unknown.status_code == 404


async def test_staff_and_visitors_cannot_use_the_request_routes(
    client: AsyncClient, provider: User, demo_users: dict[Role, User], clock: None
) -> None:
    saved = (await register(client, provider, save_as_draft=True)).json()

    assert (await client.get(f"/provider/requests/{saved['link_id']}")).status_code == 401
    assert (await read_request(client, demo_users[Role.editor], saved["link_id"])).status_code == 403
    assert (await client.put(f"/provider/requests/{saved['link_id']}", json=FULL_FORM)).status_code == 401


async def test_saving_a_draft_changes_the_listing_and_keeps_it_a_draft(
    client: AsyncClient, session: AsyncSession, provider: User, clock: None
) -> None:
    saved = (await register(client, provider, save_as_draft=True)).json()

    response = await save_request(
        client,
        provider,
        saved["link_id"],
        save_as_draft=True,
        description="Open every day.",
        landmark="Near the bridge",
        services=["X-ray"],
        is_24_hours=True,
        other_phones=[],
    )

    assert response.status_code == 200 and response.json()["status"] == "draft"
    listing = await the_listing(session, saved["listing_id"])
    assert (listing.description, listing.landmark, listing.is_24_hours) == (
        "Open every day.",
        "Near the bridge",
        True,
    )
    services = (await session.exec(select(Service).where(Service.listing_id == listing.id))).all()
    assert [s.name for s in services] == ["X-ray"]
    phones = (await session.exec(select(PhoneNumber).where(PhoneNumber.listing_id == listing.id))).all()
    assert len(phones) == 1
    changed = (
        await session.exec(
            select(AuditEntry).where(AuditEntry.listing_id == listing.id, AuditEntry.action == "update")
        )
    ).all()
    assert {"description", "landmark", "services", "phones"} <= {entry.field_changed for entry in changed}
    assert (await the_link(session, saved["link_id"])).status == "draft"


async def test_the_email_of_the_listing_changes_and_is_audited(
    client: AsyncClient, session: AsyncSession, provider: User, clock: None
) -> None:
    saved = (await register(client, provider, save_as_draft=True)).json()

    await save_request(
        client, provider, saved["link_id"], save_as_draft=True, email="new-desk@clinic.example.com"
    )

    assert (await the_listing(session, saved["listing_id"])).email == "new-desk@clinic.example.com"
    entries = (
        await session.exec(
            select(AuditEntry).where(
                AuditEntry.listing_id == saved["listing_id"], AuditEntry.field_changed == "email"
            )
        )
    ).all()
    assert len(entries) == 1


async def test_sending_a_draft_asks_for_the_first_month(
    client: AsyncClient, session: AsyncSession, provider: User, clock: None
) -> None:
    saved = (await register(client, provider, save_as_draft=True)).json()

    response = await save_request(client, provider, saved["link_id"], save_as_draft=False)

    assert response.status_code == 200
    body = response.json()
    assert (body["status"], body["fee_naira"]) == ("awaiting_payment", "10000.00")
    assert (await the_link(session, saved["link_id"])).status == "awaiting_payment"
    sent = (
        await session.exec(
            select(AuditEntry).where(
                AuditEntry.action == "owner_request", AuditEntry.listing_id == saved["listing_id"]
            )
        )
    ).all()
    assert len(sent) == 1  # the request is written to the audit log when it is sent


async def test_sending_a_request_that_needed_changes_puts_it_back_in_front_of_staff_without_a_new_payment(
    client: AsyncClient, session: AsyncSession, provider: User, clock: None
) -> None:
    listing = await add_listing(
        session, "Needs Changes Clinic", category_slug="clinic", status=ListingStatus.draft
    )
    link = await add_owner_link(session, listing, provider, status="changes_requested")
    await session.commit()
    paid_until = link.paid_until

    response = await save_request(
        client,
        provider,
        link.id,
        facility_name="Needs Changes Clinic",
        phone="08030000044",
        other_phones=[],
        save_as_draft=False,
    )

    assert response.status_code == 200 and response.json()["status"] == "pending"
    again = await the_link(session, link.id)
    assert (again.status, again.paid_until) == ("pending", paid_until)


async def test_saving_a_request_that_needed_changes_keeps_it_that_way(
    client: AsyncClient, session: AsyncSession, provider: User, clock: None
) -> None:
    listing = await add_listing(
        session, "Keep Changes Clinic", category_slug="clinic", status=ListingStatus.draft
    )
    link = await add_owner_link(session, listing, provider, status="changes_requested")
    await session.commit()

    response = await save_request(
        client,
        provider,
        link.id,
        facility_name="Keep Changes Clinic",
        phone="08030000045",
        other_phones=[],
        save_as_draft=True,
    )

    assert response.status_code == 200 and response.json()["status"] == "changes_requested"


@pytest.mark.parametrize("state", ["awaiting_payment", "pending", "approved", "removed"])
async def test_a_request_in_any_other_state_cannot_be_edited(
    client: AsyncClient, session: AsyncSession, provider: User, clock: None, state: str
) -> None:
    saved = (await register(client, provider, save_as_draft=True)).json()
    link = await the_link(session, saved["link_id"])
    link.status = state
    session.add(link)
    await session.commit()

    response = await save_request(client, provider, saved["link_id"], description="Changed")

    assert response.status_code == 409
    assert (await the_listing(session, saved["listing_id"])).description == "A small clinic for families."


async def test_an_edit_may_keep_its_own_phone_but_not_take_another_listings(
    client: AsyncClient, session: AsyncSession, provider: User, clock: None
) -> None:
    await add_listing(session, "Taken Pharmacy", category_slug="clinic", phone="+2348030000555")
    saved = (await register(client, provider, save_as_draft=True)).json()

    same = await save_request(
        client, provider, saved["link_id"], save_as_draft=True, description="Same phone"
    )
    taken = await save_request(
        client, provider, saved["link_id"], save_as_draft=True, phone="08030000555", other_phones=[]
    )

    assert same.status_code == 200
    assert taken.status_code == 409


# ---------- the owner's statuses ----------


async def test_my_facilities_shows_the_new_states_and_the_listing_status(
    client: AsyncClient, session: AsyncSession, provider: User, clock: None
) -> None:
    saved = (await register(client, provider, save_as_draft=True)).json()
    changes = await add_listing(session, "Changes Clinic", category_slug="clinic", status=ListingStatus.draft)
    await add_owner_link(session, changes, provider, status="changes_requested")
    published = await add_listing(session, "Live Clinic", category_slug="clinic")
    await add_owner_link(session, published, provider, status="approved")
    await session.commit()

    response = await client.get("/provider/listings", headers=bearer_for(provider))

    items = {item["name"]: item for item in response.json()["items"]}
    assert (
        items["Example Clinic"]["status"],
        items["Example Clinic"]["fee_state"],
        items["Example Clinic"]["listing_status"],
    ) == ("draft", "draft", "draft")
    assert (items["Changes Clinic"]["status"], items["Changes Clinic"]["fee_state"]) == (
        "changes_requested",
        "changes_requested",
    )
    assert (items["Live Clinic"]["status"], items["Live Clinic"]["listing_status"]) == (
        "approved",
        "published",
    )
    assert saved["link_id"] == items["Example Clinic"]["link_id"]


async def test_withdrawing_a_draft_removes_it_with_no_refund(
    client: AsyncClient, session: AsyncSession, provider: User, recorder: Recorder, clock: None
) -> None:
    saved = (await register(client, provider, save_as_draft=True)).json()

    response = await client.post(f"/provider/links/{saved['link_id']}/cancel", headers=bearer_for(provider))

    assert response.status_code == 200 and response.json()["status"] == "removed"
    assert recorder.refunds == []


async def test_withdrawing_a_request_that_needed_changes_gives_the_payment_back(
    client: AsyncClient, session: AsyncSession, provider: User, recorder: Recorder, clock: None
) -> None:
    listing = await add_listing(
        session, "Refund Changes Clinic", category_slug="clinic", status=ListingStatus.draft
    )
    link = await add_owner_link(session, listing, provider, status="changes_requested")
    session.add(
        AuditEntry(
            listing_id=listing.id,
            action="payment",
            field_changed="paid_until",
            reference=f"SO-{link.id}-1730000000",
            changed_at=NOW,
        )
    )
    await session.commit()

    response = await client.post(f"/provider/links/{link.id}/cancel", headers=bearer_for(provider))

    assert response.status_code == 200 and response.json()["refund"] == "done"
    assert recorder.refunds == [f"SO-{link.id}-1730000000"]


# ---------- the email is for staff only ----------


async def test_the_email_is_in_the_staff_detail_and_in_no_public_answer(
    client: AsyncClient, session: AsyncSession, provider: User, demo_users: dict[Role, User], clock: None
) -> None:
    listing = await add_listing(session, "Public Clinic", category_slug="clinic")
    listing.email = "private-desk@clinic.example.com"
    session.add(listing)
    await session.commit()

    staff = await client.get(f"/listings/id/{listing.id}", headers=bearer_for(demo_users[Role.editor]))
    public = await client.get(f"/listings/{listing.slug}")
    searched = await client.get("/search", params={"q": "Public Clinic"})

    assert staff.json()["email"] == "private-desk@clinic.example.com"
    assert "email" not in public.json() and "private-desk" not in public.text
    assert "private-desk" not in searched.text
