"""Paying the owner fee: start, the signed webhook, the status, receipts.
Requirements: FR-44, FR-46, FR-50, NFR-06, NFR-07. Spec: specs/2026-10-29-owner-fee/ (section 3.2
to 3.4, 3.6). Paystack TEST mode only, and never called here: the start is replaced by a recorder,
events are signed with a fictional key the way Paystack documents it (HMAC SHA-512 of the raw
body). Every person, address and key here is fictional.
"""

import hashlib
import hmac
import json
from collections.abc import Iterator
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment
from app.core.config import settings
from app.core.months import add_one_month
from app.integrations import paystack, resend
from app.main import app
from app.models import AuditEntry, FacilityOwner, User
from app.models.base import Role
from app.repositories import user_repository
from tests.factories import add_listing, add_owner_link
from tests.staff_helpers import bearer_for

pytestmark = pytest.mark.anyio

NOW = datetime(2026, 10, 29, 9, 0, tzinfo=timezone.utc)
TEST_KEY = "sk_test_not_a_real_key"
KOBO = 1_000_000  # the default fee, 10000.00 naira


@pytest.fixture(autouse=True)
def test_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "paystack_secret_key", TEST_KEY)


@pytest.fixture
def clock() -> Iterator[None]:
    app.dependency_overrides[get_current_moment] = lambda: NOW
    yield
    app.dependency_overrides.pop(get_current_moment, None)


class Recorder:
    """Stands in for the Paystack start and for Resend: remembers what they were asked."""

    def __init__(self) -> None:
        self.started: list[dict] = []
        self.emails: list[tuple[str, str, str]] = []
        self.email_error: Exception | None = None

    async def initialize_transaction(self, **fields: object) -> paystack.StartedPayment:
        self.started.append(fields)
        return paystack.StartedPayment(
            authorization_url="https://checkout.example.test/pay", reference=str(fields["reference"])
        )

    async def send_email(self, to: str, subject: str, body: str, **_options: object) -> None:
        if self.email_error:
            raise self.email_error
        self.emails.append((to, subject, body))


@pytest.fixture
def recorder(monkeypatch: pytest.MonkeyPatch) -> Recorder:
    made = Recorder()
    monkeypatch.setattr(paystack, "initialize_transaction", made.initialize_transaction)
    monkeypatch.setattr(resend, "send_email", made.send_email)
    return made


@pytest.fixture
async def stranger(session: AsyncSession, demo_password_hash: str) -> User:
    """A second provider account, for the tests about other people's links."""
    user = await user_repository.create(
        session,
        name="Other Provider",
        email="other@demo.example.com",
        phone="+2340000000777",
        password_hash=demo_password_hash,
        role=Role.provider,
    )
    await session.commit()
    return user


def sign(body: bytes, key: str = TEST_KEY) -> str:
    return hmac.new(key.encode(), body, hashlib.sha512).hexdigest()


def charge_success(link: FacilityOwner, **changes: object) -> dict:
    data: dict = {
        "reference": f"SO-{link.id}-1730000000",
        "status": "success",
        "amount": KOBO,
        "currency": "NGN",
        "metadata": {"link_id": link.id, "kind": "owner_fee"},
        "customer": {"email": "customer@example.test"},
    }
    data.update(changes)
    return {"event": "charge.success", "data": data}


async def post_event(client: AsyncClient, event: object, signature: str | None = "valid"):
    body = json.dumps(event).encode()
    headers = {"content-type": "application/json"}
    if signature == "valid":
        headers["x-paystack-signature"] = sign(body)
    elif signature is not None:
        headers["x-paystack-signature"] = signature
    return await client.post("/payments/webhook", content=body, headers=headers)


async def make_link(session: AsyncSession, provider: User, name: str = "Fee Clinic", **options: object):
    listing = await add_listing(session, name)
    link = await add_owner_link(session, listing, provider, **options)
    await session.commit()
    return listing, link


async def payments_of(session: AsyncSession) -> list[AuditEntry]:
    rows = await session.exec(
        select(AuditEntry).where(AuditEntry.action == "payment").order_by(AuditEntry.id)
    )
    return list(rows.all())


async def fresh(session: AsyncSession, link: FacilityOwner) -> FacilityOwner:
    await session.refresh(link)
    return link


async def start(client: AsyncClient, user: User | None, link_id: object):
    headers = bearer_for(user) if user else {}
    return await client.post("/payments/owner-fee", json={"link_id": link_id}, headers=headers)


# --- the first request is free of money and invisible to staff ---

REGISTER_BODY = {
    "facility_name": "Fresh Example Clinic",
    "category": "clinic",
    "area": "Ogui",
    "address": "4 Example Street",
    "phone": "0803 000 0000",
    "role": "owner",
}


async def test_a_new_request_waits_for_payment_and_staff_do_not_see_it(
    client: AsyncClient, session: AsyncSession, demo_users, clock
):
    provider, editor = demo_users[Role.provider], demo_users[Role.editor]
    await add_listing(session, "Other Clinic", category_slug="clinic")
    await session.commit()

    response = await client.post("/provider/facilities", json=REGISTER_BODY, headers=bearer_for(provider))

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "awaiting_payment" and body["fee_naira"] == "10000.00"
    link = (await session.exec(select(FacilityOwner).where(FacilityOwner.id == body["link_id"]))).one()
    assert (link.status, link.paid_until) == ("awaiting_payment", None)
    queue = await client.get("/staff/owner-requests", headers=bearer_for(editor))
    assert queue.json()["total"] == 0


# --- POST /payments/owner-fee ---


async def test_start_asks_paystack_for_the_fee_from_the_setting_and_saves_nothing(
    client: AsyncClient, session: AsyncSession, demo_users, recorder, clock
):
    provider = demo_users[Role.provider]
    _, link = await make_link(session, provider, status="awaiting_payment")

    response = await start(client, provider, link.id)

    assert response.status_code == 200
    assert response.json() == {
        "authorization_url": "https://checkout.example.test/pay",
        "reference": f"SO-{link.id}-{int(NOW.timestamp())}",
        "amount_naira": "10000.00",
    }
    [asked] = recorder.started
    assert asked["amount_kobo"] == KOBO and isinstance(asked["amount_kobo"], int)
    assert asked["email"] == provider.email
    assert asked["metadata"] == {"link_id": link.id, "kind": "owner_fee"}
    assert str(asked["callback_url"]).endswith("/provider/fee-complete")
    assert (await fresh(session, link)).status == "awaiting_payment"
    assert await payments_of(session) == []


async def test_the_amount_comes_from_the_setting_and_never_from_the_request(
    client: AsyncClient, session: AsyncSession, demo_users, recorder, clock, monkeypatch
):
    provider = demo_users[Role.provider]
    _, link = await make_link(session, provider, status="awaiting_payment")
    monkeypatch.setattr(settings, "owner_fee_naira", __import__("decimal").Decimal("12500.50"))

    response = await client.post(
        "/payments/owner-fee", json={"link_id": link.id, "amount": 1}, headers=bearer_for(provider)
    )

    assert response.status_code == 422  # an amount in the request is refused outright
    again = await start(client, provider, link.id)
    assert again.json()["amount_naira"] == "12500.50"
    assert recorder.started[0]["amount_kobo"] == 1_250_050


@pytest.mark.parametrize("status", ["awaiting_payment", "approved", "lapsed", "ending"])
async def test_these_links_can_pay(client, session, demo_users, recorder, clock, status):
    provider = demo_users[Role.provider]
    _, link = await make_link(session, provider, status=status)

    assert (await start(client, provider, link.id)).status_code == 200


@pytest.mark.parametrize("status", ["pending", "removed"])
async def test_a_link_waiting_for_staff_or_removed_cannot_pay(
    client, session, demo_users, recorder, clock, status
):
    provider = demo_users[Role.provider]
    _, link = await make_link(session, provider, status=status)

    response = await start(client, provider, link.id)

    assert response.status_code == 409
    assert recorder.started == []


async def test_nobody_can_pay_for_another_persons_link(client, session, demo_users, recorder, clock):
    owner, other = demo_users[Role.provider], demo_users[Role.verifier]
    _, link = await make_link(session, owner, status="awaiting_payment")

    assert (await start(client, other, link.id)).status_code == 403  # only a provider may pay
    assert (await start(client, None, link.id)).status_code == 401
    assert (await start(client, owner, link.id + 999)).status_code == 404
    assert recorder.started == []


async def test_a_provider_cannot_pay_for_the_link_of_another_provider(
    client, session, demo_users, recorder, clock, stranger
):
    owner = demo_users[Role.provider]
    _, link = await make_link(session, owner, status="awaiting_payment")

    assert (await start(client, stranger, link.id)).status_code == 404
    assert recorder.started == []


async def test_without_a_key_or_with_a_live_key_nothing_is_started(
    client, session, demo_users, clock, monkeypatch
):
    provider = demo_users[Role.provider]
    _, link = await make_link(session, provider, status="awaiting_payment")

    monkeypatch.setattr(settings, "paystack_secret_key", "")
    assert (await start(client, provider, link.id)).status_code == 503
    monkeypatch.setattr(settings, "paystack_secret_key", "sk_live_not_allowed")
    live = await start(client, provider, link.id)
    assert live.status_code == 503 and live.json()["detail"] == "Live payments are switched off."


# --- the webhook ---


async def test_the_first_payment_sends_the_request_to_staff_and_starts_the_paid_month(
    client, session, demo_users, recorder, clock
):
    provider, editor = demo_users[Role.provider], demo_users[Role.editor]
    listing, link = await make_link(session, provider, status="awaiting_payment")

    response = await post_event(client, charge_success(link))

    assert response.status_code == 200
    link = await fresh(session, link)
    assert (link.status, link.paid_until) == ("pending", add_one_month(NOW))
    [entry] = await payments_of(session)
    assert (entry.reference, entry.listing_id, entry.user_id) == (
        f"SO-{link.id}-1730000000",
        listing.id,
        None,
    )
    assert (entry.field_changed, entry.old_value, entry.new_value) == (
        "paid_until",
        None,
        add_one_month(NOW).isoformat(),
    )
    queue = (await client.get("/staff/owner-requests", headers=bearer_for(editor))).json()
    assert [item["id"] for item in queue["items"]] == [link.id]


async def test_a_repeated_webhook_applies_once(client, session, demo_users, recorder, clock):
    provider = demo_users[Role.provider]
    _, link = await make_link(session, provider, status="awaiting_payment")
    event = charge_success(link)

    await post_event(client, event)
    first = (await fresh(session, link)).paid_until
    again = await post_event(client, event)

    assert again.status_code == 200
    assert (await fresh(session, link)).paid_until == first
    assert len(await payments_of(session)) == 1
    assert len(recorder.emails) == 1  # one receipt, not two


@pytest.mark.parametrize(
    "change",
    [
        {"amount": KOBO - 1},
        {"amount": 1.5},
        {"status": "failed"},
        {"metadata": {"link_id": 999999, "kind": "owner_fee"}},
        {"reference": "SO-999999-1730000000", "metadata": {"link_id": 999999, "kind": "owner_fee"}},
        {"metadata": {"kind": "owner_fee"}},
    ],
)
async def test_an_event_that_is_not_a_good_payment_changes_nothing(
    client, session, demo_users, recorder, clock, change
):
    provider = demo_users[Role.provider]
    _, link = await make_link(session, provider, status="awaiting_payment")

    response = await post_event(client, charge_success(link, **change))

    assert response.status_code == 200  # Paystack is always told "ok"
    assert (await fresh(session, link)).status == "awaiting_payment"
    assert await payments_of(session) == []


@pytest.mark.parametrize("signature", [None, "", "wrong", "00" * 64])
async def test_a_missing_or_wrong_signature_is_401_and_changes_nothing(
    client, session, demo_users, recorder, clock, signature
):
    provider = demo_users[Role.provider]
    _, link = await make_link(session, provider, status="awaiting_payment")

    response = await post_event(client, charge_success(link), signature=signature)

    assert response.status_code == 401
    assert (await fresh(session, link)).status == "awaiting_payment"
    assert await payments_of(session) == []


async def test_a_renewal_adds_a_month_to_the_end_of_the_paid_month_so_an_early_payment_loses_nothing(
    client, session, demo_users, recorder, clock
):
    provider = demo_users[Role.provider]
    paid_until = NOW + timedelta(days=10)
    _, link = await make_link(session, provider, status="approved", paid_until=paid_until)

    await post_event(client, charge_success(link))

    link = await fresh(session, link)
    assert (link.status, link.paid_until) == ("approved", add_one_month(paid_until))


async def test_a_lapsed_owner_who_pays_edits_again_at_once_without_staff(
    client, session, demo_users, recorder, clock
):
    provider = demo_users[Role.provider]
    listing, link = await make_link(session, provider, status="lapsed", paid_until=NOW - timedelta(days=40))
    assert (await client.get("/provider/listing", headers=bearer_for(provider))).status_code == 404

    await post_event(client, charge_success(link))

    link = await fresh(session, link)
    assert (link.status, link.paid_until) == ("approved", add_one_month(NOW))  # the month starts now
    assert (await client.get("/provider/listing", headers=bearer_for(provider))).status_code == 200


async def test_an_owner_who_cancelled_and_pays_again_keeps_managing(
    client, session, demo_users, recorder, clock
):
    provider = demo_users[Role.provider]
    _, link = await make_link(session, provider, status="ending", paid_until=NOW + timedelta(days=5))

    await post_event(client, charge_success(link))

    assert (await fresh(session, link)).status == "approved"


async def test_a_payment_for_a_removed_link_is_recorded_once_but_gives_no_access(
    client, session, demo_users, recorder, clock
):
    provider = demo_users[Role.provider]
    _, link = await make_link(session, provider, status="removed")

    await post_event(client, charge_success(link))
    await post_event(client, charge_success(link))

    assert (await fresh(session, link)).status == "removed"
    assert len(await payments_of(session)) == 1  # so an admin can see it and refund it
    assert recorder.emails == []


async def test_a_featured_payment_is_still_handled_by_the_featured_rules(
    client, session, demo_users, recorder, clock
):
    provider = demo_users[Role.provider]
    listing, link = await make_link(session, provider, status="approved")

    featured = {
        "event": "charge.success",
        "data": {
            "reference": f"SH-{listing.id}-1730000001",
            "status": "success",
            "amount": 500000,
            "metadata": {"listing_id": listing.id},
        },
    }
    await post_event(client, featured)

    await session.refresh(listing)
    assert listing.featured_until is not None


# --- GET /payments/owner-fee/{reference} ---


async def test_the_status_is_pending_until_the_webhook_and_then_success(
    client, session, demo_users, recorder, clock
):
    provider = demo_users[Role.provider]
    _, link = await make_link(session, provider, status="awaiting_payment")
    reference = f"SO-{link.id}-1730000000"

    before = await client.get(f"/payments/owner-fee/{reference}", headers=bearer_for(provider))
    await post_event(client, charge_success(link))
    after = await client.get(f"/payments/owner-fee/{reference}", headers=bearer_for(provider))

    assert before.json() == {"status": "pending", "link_status": "awaiting_payment", "paid_until": None}
    assert after.json() == {
        "status": "success",
        "link_status": "pending",
        "paid_until": "2026-11-29T09:00:00Z",
    }


async def test_the_status_of_another_persons_payment_or_a_wrong_reference_is_404(
    client, session, demo_users, recorder, clock, stranger
):
    owner = demo_users[Role.provider]
    _, link = await make_link(session, owner, status="awaiting_payment")

    for reference in ("SH-1-1", "nonsense", "SO-999999-1"):
        assert (
            await client.get(f"/payments/owner-fee/{reference}", headers=bearer_for(owner))
        ).status_code == 404
    assert (
        await client.get(f"/payments/owner-fee/SO-{link.id}-1", headers=bearer_for(stranger))
    ).status_code == 404


# --- receipts ---


async def test_a_receipt_is_emailed_with_the_amount_the_period_and_the_reference(
    client, session, demo_users, recorder, clock
):
    provider = demo_users[Role.provider]
    listing, link = await make_link(session, provider, name="Receipt Clinic", status="awaiting_payment")

    await post_event(client, charge_success(link))

    [(to, subject, body)] = recorder.emails
    assert to == provider.email
    assert "receipt" in subject.lower()
    for expected in (
        "Receipt Clinic",
        "₦10,000.00",
        "29 October 2026",
        "29 November 2026",
        f"SO-{link.id}-1730000000",
    ):
        assert expected in body, expected
    assert "sk_test" not in body


async def test_a_failing_email_never_fails_the_payment(client, session, demo_users, recorder, clock):
    provider = demo_users[Role.provider]
    _, link = await make_link(session, provider, status="awaiting_payment")
    recorder.email_error = resend.EmailSendError("down")

    response = await post_event(client, charge_success(link))

    assert response.status_code == 200
    assert (await fresh(session, link)).status == "pending"


async def test_the_payments_list_shows_only_the_callers_own_payments(
    client, session, demo_users, recorder, clock, stranger
):
    owner = demo_users[Role.provider]
    listing, link = await make_link(session, owner, name="Listed Clinic", status="awaiting_payment")
    _, other_link = await make_link(session, stranger, name="Other Clinic", status="awaiting_payment")
    await post_event(client, charge_success(link))
    await post_event(client, charge_success(other_link, reference=f"SO-{other_link.id}-1730000005"))

    mine = (await client.get("/provider/payments", headers=bearer_for(owner))).json()

    assert mine["items"] == [
        {
            "reference": f"SO-{link.id}-1730000000",
            "kind": "owner_fee",
            "listing_id": listing.id,
            "listing_name": "Listed Clinic",
            "paid_at": "2026-10-29T09:00:00Z",
            "paid_until": "2026-11-29T09:00:00Z",
        }
    ]
    assert (
        await client.get("/provider/payments", headers=bearer_for(demo_users[Role.editor]))
    ).status_code == 403
