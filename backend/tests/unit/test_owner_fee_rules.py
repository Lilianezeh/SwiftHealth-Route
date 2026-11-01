"""The pure rules of the owner fee. Requirements: FR-44, FR-46, FR-50, NFR-06.
Spec: specs/2026-10-29-owner-fee/.

A facility owner pays a fee each calendar month (Paystack test mode) to claim and manage a
listing. Here: the month arithmetic, the reference and the amount, what a good Paystack event
looks like, and where a link is in its life (`fee_state`). Nothing here touches a database or
Paystack. Every value is fictional.
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest

from app.core.config import Settings
from app.services import owner_fee_service as fee

UTC = timezone.utc
NOW = datetime(2026, 10, 29, 9, 30, tzinfo=UTC)


# --- the month ---


@pytest.mark.parametrize(
    ("start", "expected"),
    [
        (datetime(2026, 10, 29, 9, 30, tzinfo=UTC), datetime(2026, 11, 29, 9, 30, tzinfo=UTC)),
        (datetime(2026, 1, 31, 8, 0, tzinfo=UTC), datetime(2026, 2, 28, 8, 0, tzinfo=UTC)),  # no 31 Feb
        (datetime(2028, 1, 31, 8, 0, tzinfo=UTC), datetime(2028, 2, 29, 8, 0, tzinfo=UTC)),  # leap year
        (datetime(2026, 3, 31, 8, 0, tzinfo=UTC), datetime(2026, 4, 30, 8, 0, tzinfo=UTC)),
        (datetime(2026, 12, 15, 23, 59, tzinfo=UTC), datetime(2027, 1, 15, 23, 59, tzinfo=UTC)),
    ],
)
def test_one_calendar_month_later_keeps_the_day_or_the_last_day_of_the_month(start, expected):
    assert fee.add_one_month(start) == expected


# --- settings ---


def test_the_fee_defaults_to_10000_naira_with_a_7_day_grace_and_reminders_at_7_3_and_1_days():
    settings = Settings(_env_file=None)
    assert settings.owner_fee == Decimal("10000.00")
    assert str(settings.owner_fee) == "10000.00"  # two decimals, as money is sent in JSON
    assert settings.owner_fee_grace_days == 7
    assert settings.owner_fee_reminder_day_list == [7, 3, 1]


def test_the_fee_and_the_other_numbers_come_from_settings():
    settings = Settings(
        _env_file=None, owner_fee_naira="12500.5", owner_fee_grace_days=3, owner_fee_reminder_days="10, 2"
    )
    assert settings.owner_fee == Decimal("12500.50")
    assert settings.owner_fee_grace_days == 3
    assert settings.owner_fee_reminder_day_list == [10, 2]


def test_the_amount_for_paystack_is_a_whole_number_of_kobo(monkeypatch):
    assert fee.amount_in_kobo() == 1_000_000
    monkeypatch.setattr(fee.settings, "owner_fee_naira", Decimal("12500.50"))
    assert fee.amount_in_kobo() == 1_250_050
    assert isinstance(fee.amount_in_kobo(), int)


# --- the reference ---


def test_the_reference_holds_the_link_and_the_time_and_is_told_apart_from_a_featured_one():
    reference = fee.reference_for(12, datetime.fromtimestamp(1_730_000_000, tz=UTC))
    assert reference == "SO-12-1730000000"
    assert fee.link_id_of(reference) == 12
    for other in ("SH-12-1730000000", "SO-12", "SO-x-1", "so-12-1", "SO-12-1730000000-9", ""):
        assert fee.link_id_of(other) is None


# --- a good Paystack event ---


def good_event(**data_changes: object) -> dict:
    data: dict = {
        "reference": "SO-12-1730000000",
        "status": "success",
        "amount": 1_000_000,
        "metadata": {"link_id": 12, "kind": "owner_fee"},
    }
    data.update(data_changes)
    return {"event": "charge.success", "data": data}


def test_a_good_event_is_read():
    event = fee.parse_charge_success(good_event())
    assert event == fee.ChargeEvent(reference="SO-12-1730000000", link_id=12, amount_kobo=1_000_000)


def test_a_larger_amount_is_still_good():
    assert fee.parse_charge_success(good_event(amount=2_000_000)) is not None


@pytest.mark.parametrize(
    "event",
    [
        {"event": "charge.failed", "data": good_event()["data"]},
        {"event": "charge.success", "data": "x"},
        {"event": "charge.success"},
        good_event(status="failed"),
        good_event(amount=999_999),  # under the fee
        good_event(amount=1_000_000.0),  # a float is not a whole number of kobo
        good_event(amount=True),
        good_event(amount="1000000"),
        good_event(metadata={"link_id": 13, "kind": "owner_fee"}),  # not the link of the reference
        good_event(metadata={"link_id": "12", "kind": "owner_fee"}),
        good_event(metadata={"link_id": True, "kind": "owner_fee"}),
        good_event(metadata={"link_id": 12, "kind": "featured"}),
        good_event(metadata={"link_id": 12}),
        good_event(metadata="x"),
        good_event(reference="SH-12-1730000000"),  # a featured payment is not an owner fee
        good_event(reference=12),
    ],
)
def test_anything_else_is_ignored(event):
    assert fee.parse_charge_success(event) is None


# --- where a link is in its life ---


def state(status: str, paid_until: datetime | None) -> str:
    return fee.fee_state(status, paid_until, NOW)


def test_before_the_first_payment_and_while_staff_decide():
    assert state("awaiting_payment", None) == "awaiting_payment"
    assert state("pending", NOW + timedelta(days=30)) == "waiting_for_staff"


def test_an_approved_link_is_paid_then_in_grace_then_lapsed():
    assert state("approved", NOW + timedelta(days=1)) == "paid"
    assert state("approved", NOW) == "paid"  # the last moment of the month
    assert state("approved", NOW - timedelta(seconds=1)) == "grace"
    assert state("approved", NOW - timedelta(days=7)) == "grace"  # the 7th day still counts
    assert state("approved", NOW - timedelta(days=7, seconds=1)) == "lapsed"


def test_the_stored_lapsed_status_and_the_computed_one_agree():
    assert state("lapsed", NOW - timedelta(days=9)) == "lapsed"
    assert state("approved", None) == "lapsed"  # no paid date at all never gives access


def test_a_link_that_is_ending_has_access_until_the_paid_date_without_a_grace_period():
    assert state("ending", NOW + timedelta(days=3)) == "ending"
    assert state("ending", NOW - timedelta(seconds=1)) == "ended"


def test_a_removed_link_is_removed():
    assert state("removed", NOW + timedelta(days=30)) == "removed"


def test_only_a_paid_or_grace_or_ending_link_may_edit():
    allowed = {"paid", "grace", "ending"}
    for status, paid_until, expected in [
        ("approved", NOW + timedelta(days=1), True),
        ("approved", NOW - timedelta(days=3), True),
        ("approved", NOW - timedelta(days=8), False),
        ("approved", None, False),
        ("lapsed", NOW + timedelta(days=1), False),
        ("pending", NOW + timedelta(days=1), False),
        ("awaiting_payment", None, False),
        ("ending", NOW + timedelta(days=1), True),
        ("ending", NOW - timedelta(days=1), False),
        ("removed", NOW + timedelta(days=1), False),
    ]:
        assert (fee.fee_state(status, paid_until, NOW) in allowed) is expected, (status, paid_until)


# --- the new month ---


def test_paying_early_adds_a_month_to_the_end_of_the_paid_month_so_nothing_is_lost():
    paid_until = datetime(2026, 11, 10, 9, 0, tzinfo=UTC)
    assert fee.next_paid_until(paid_until, NOW) == datetime(2026, 12, 10, 9, 0, tzinfo=UTC)


def test_paying_late_or_for_the_first_time_starts_the_month_now():
    assert fee.next_paid_until(None, NOW) == datetime(2026, 11, 29, 9, 30, tzinfo=UTC)
    long_ago = datetime(2026, 8, 1, 9, 0, tzinfo=UTC)
    assert fee.next_paid_until(long_ago, NOW) == datetime(2026, 11, 29, 9, 30, tzinfo=UTC)
