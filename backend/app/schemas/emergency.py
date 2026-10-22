"""Response of GET /emergency (FR-14 to FR-19, FR-26). See specs/backend/api-spec.md."""
from pydantic import BaseModel

from app.schemas.listing import CategorySummary, ListingSummary


class NationalLine(BaseModel):
    name: str
    number: str


class EmergencyGroup(BaseModel):
    category: CategorySummary
    contacts: list[ListingSummary]  # may be empty: the page hides an empty group


class EmergencyResponse(BaseModel):
    national_line: NationalLine
    groups: list[EmergencyGroup]  # always the seven groups, in the order of FR-15
    disclaimer: str
