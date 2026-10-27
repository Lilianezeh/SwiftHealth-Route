"""The SwiftRescue contacts for staff: every group, every status, on one screen.
Requirements: FR-15, FR-31, FR-32. Spec: specs/backend/api-spec.md section 5, "SwiftRescue contacts for
staff" (2026-10-27).

The groups are the ones of the SwiftRescue page, in its order (`emergency_service.GROUPS`), so the two
cannot drift apart. This only reads: adding, editing and removing use the listing routes (a new contact
is a draft that is verified and published like any listing; removing is hiding, nothing is deleted).
No HTTP here.
"""

from datetime import datetime

from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import User
from app.schemas.emergency_admin import EmergencyContactGroup, EmergencyContactGroups
from app.schemas.listing import CategorySummary
from app.schemas.staff_listing import StaffListParams
from app.services import staff_listing_service
from app.services.emergency_service import GROUPS

CONTACTS_PER_GROUP = 100  # the largest page the staff list gives


async def list_groups(session: AsyncSession, user: User, moment: datetime) -> EmergencyContactGroups:
    groups = []
    for slug, name in GROUPS:
        page = await staff_listing_service.list_listings(
            session, user, StaffListParams(category=slug, limit=CONTACTS_PER_GROUP), moment
        )
        groups.append(
            EmergencyContactGroup(
                category=CategorySummary(slug=slug, name=name),
                contacts=page.items,
                total=page.total,
            )
        )
    return EmergencyContactGroups(groups=groups)
