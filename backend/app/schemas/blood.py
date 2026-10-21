"""Query parameters and answers of the blood endpoints. See specs/backend/api-spec.md
("Phase 8 rules for both blood endpoints"). Requirements: US-15, US-16, FR-27, FR-28.
Decisions F1 to F5 in specs/2026-10-20-blood/requirements.md.
"""

from datetime import date

from pydantic import BaseModel, Field, field_validator

from app.core.config import BLOOD_GROUPS
from app.schemas.listing import ListingSummary, OpeningHoursRead
from app.schemas.location import LocationParams

STOCK_NOTE = "Stock changes daily; call to confirm before you go."


class PagedLocationParams(LocationParams):
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class BloodBankParams(PagedLocationParams):
    blood_group: str | None = Field(
        default=None,
        description="One of the eight blood groups of GET /meta: A+, A-, B+, B-, AB+, AB-, O+, O-.",
    )

    @field_validator("blood_group")
    @classmethod
    def group_is_one_of_the_eight(cls, group: str | None) -> str | None:
        if group is not None and group not in BLOOD_GROUPS:
            raise ValueError("blood_group must be one of the blood groups in /meta")
        return group


class BloodBankItem(ListingSummary):
    blood_groups: list[str]  # in the order of BLOOD_GROUPS
    blood_groups_confirmed_at: date | None
    stock_note: str = STOCK_NOTE


class BloodBankList(BaseModel):
    items: list[BloodBankItem]
    total: int


class DonationCentreItem(ListingSummary):
    donation_hours: list[OpeningHoursRead]  # the 7-entry week, Monday first


class DonationCentreList(BaseModel):
    items: list[DonationCentreItem]
    total: int
