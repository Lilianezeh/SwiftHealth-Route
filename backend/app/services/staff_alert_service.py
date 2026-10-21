"""Tells the staff that a listing was flagged for an urgent re-check. Requirements: FR-22, NFR-07.

Editors and admins get an email (Resend), admins also get an SMS (Termii). The texts hold the listing
name only: never the comment, the reporter's phone or anything else about the reporter. Sending is best
effort: a failure is logged without any address or number and never reaches the visitor whose report
caused it. With no key nothing is sent (the integrations log that).
Decision B6 in specs/2026-10-20-reports/requirements.md.
"""

import logging
from dataclasses import dataclass

from sqlmodel.ext.asyncio.session import AsyncSession

from app.integrations import resend, termii
from app.models.base import Role
from app.repositories import user_repository

logger = logging.getLogger(__name__)

REPORTS_TO_FLAG = 2  # FR-22, named in the text so the text always agrees with the rule


@dataclass(frozen=True)
class StaffAlert:
    """What to send and to whom. Loaded during the request: the session is closed once the answer is sent."""

    listing_name: str
    editor_emails: list[str]
    admin_phones: list[str]


def build_alert_texts(listing_name: str) -> tuple[str, str, str]:
    """The email subject, the email body and the SMS."""
    subject = f"Urgent re-check: {listing_name}"
    body = (
        f"{listing_name} was reported as not working by {REPORTS_TO_FLAG} different people within 7 days. "
        "It is hidden from the public until it is re-checked. Open the report queue to look at it."
    )
    sms = (
        f"SwiftHealth Route: {listing_name} was reported not working by {REPORTS_TO_FLAG} people "
        "and is hidden. Re-check it."
    )
    return subject, body, sms


async def load_alert(session: AsyncSession, listing_name: str) -> StaffAlert:
    """Finds who to tell: every active editor and admin with an email, every active admin with a phone."""
    staff = await user_repository.list_active_with_roles(session, {Role.editor, Role.admin})
    return StaffAlert(
        listing_name=listing_name,
        editor_emails=[user.email for user in staff],
        admin_phones=[user.phone for user in staff if user.role == Role.admin and user.phone],
    )


async def send_alerts(alert: StaffAlert) -> None:
    """Sends every message. One failure never stops the others, and nothing here raises."""
    subject, body, sms = build_alert_texts(alert.listing_name)
    for email in alert.editor_emails:
        try:
            await resend.send_email(email, subject, body)
        except resend.EmailSendError as error:
            logger.warning("Staff alert email failed: %s", error)
    for phone in alert.admin_phones:
        try:
            await termii.send_sms(phone, sms)
        except termii.SmsSendError as error:
            logger.warning("Staff alert SMS failed: %s", error)
