"""The SwiftRescue contacts for staff. See specs/backend/api-spec.md section 5,
"SwiftRescue contacts for staff". Requirements: FR-15, FR-31, FR-32."""

from pydantic import BaseModel

from app.schemas.listing import CategorySummary
from app.schemas.staff_listing import StaffListingSummary


class EmergencyContactGroup(BaseModel):
    category: CategorySummary
    contacts: list[StaffListingSummary]  # every status, by name, at most CONTACTS_PER_GROUP
    total: int  # how many the group really has


class EmergencyContactGroups(BaseModel):
    groups: list[EmergencyContactGroup]
