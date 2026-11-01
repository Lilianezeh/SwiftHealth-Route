"""The emails of the owner fee: receipts, reminders, the lapse notice and the refund notice.
Requirements: FR-50, NFR-07. Spec: specs/2026-10-29-owner-fee/ (section 3.6).

Plain text through Resend (integrations/resend.py). Sending is best effort: a failure is logged without any
address and never reaches the payment or the job that asked. The texts hold the facility's name, the amount,
the dates and our reference, and nothing else (no card detail, no key). They claim nothing about tax: whether
a receipt must be a tax invoice is a question for the lawyer (specs/2026-10-29-owner-fee/requirements.md, L6).
"""

import logging
from datetime import datetime
from decimal import Decimal

from app.core.config import settings
from app.integrations import resend

logger = logging.getLogger(__name__)


def naira(amount_kobo: int) -> str:
    """kobo as naira, 2 decimals and thousands: 1000000 becomes "₦10,000.00". No float."""
    return f"₦{(Decimal(amount_kobo) / 100):,.2f}"


def day(moment: datetime) -> str:
    return f"{moment.day} {moment:%B %Y}"


def receipt_texts(
    *, facility_name: str, amount_kobo: int, period_start: datetime, period_end: datetime, reference: str
) -> tuple[str, str]:
    subject = f"Receipt: {facility_name}, managing your listing"
    body = (
        f"Thank you. We received your payment for managing {facility_name} on SwiftHealth Route.\n\n"
        f"Amount: {naira(amount_kobo)}\n"
        f"Covers: {day(period_start)} to {day(period_end)}\n"
        f"Reference: {reference}\n\n"
        "This fee is for the tools to edit and manage your listing. Being listed, found and verified "
        "is free, and paying does not change how your listing is checked or ranked."
    )
    return subject, body


def reminder_texts(facility_name: str, paid_until: datetime, days_left: int) -> tuple[str, str]:
    when = "today" if days_left <= 0 else f"in {days_left} day{'s' if days_left != 1 else ''}"
    subject = f"Your month for {facility_name} ends {when}"
    body = (
        f"The month you paid for managing {facility_name} ends {when} ({day(paid_until)}). "
        f"Log in and choose Pay for next month ({naira(int(settings.owner_fee * 100))}) to keep editing. "
        "Nothing is charged automatically. If you do not pay, you keep a grace period of "
        f"{settings.owner_fee_grace_days} days; after that you can no longer edit, but your listing stays "
        "public and free."
    )
    return subject, body


def lapsed_texts(facility_name: str) -> tuple[str, str]:
    subject = f"You can no longer edit {facility_name}"
    body = (
        f"The month for managing {facility_name} and the grace period have ended, so you can no "
        "longer edit it. "
        "Your listing is still public and free, and nothing was deleted. Log in and pay to edit again "
        f"({naira(int(settings.owner_fee * 100))}); you do not need our team to approve you again."
    )
    return subject, body


def refund_texts(facility_name: str) -> tuple[str, str]:
    subject = f"Your payment for {facility_name} is being given back"
    body = (
        f"We did not approve the request to manage {facility_name}, or you withdrew it, so your payment is "
        "being given back in full through Paystack. It can take a few days to reach you."
    )
    return subject, body


async def send_best_effort(to: str, subject: str, body: str) -> None:
    """Sends one email; a failure is logged (never the address) and ignored."""
    try:
        await resend.send_email(to, subject, body)
    except resend.EmailSendError as error:
        logger.warning("Owner fee email not sent (%s)", type(error).__name__)
