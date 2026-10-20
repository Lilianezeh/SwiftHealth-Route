"""Shapes of the provider endpoints. See specs/backend/api-spec.md, section 7 ("Phase 12 rules").
Requirements: FR-43, NFR-06. Decisions I1 and I2 in specs/2026-10-20-providers-payments/requirements.md.
"""

from decimal import Decimal
from typing import Self

from pydantic import ConfigDict, model_validator

from app.schemas.staff_listing import ListingUpdate, StaffListingDetail

PROVIDER_FIELDS = frozenset({"description", "services", "opening_hours", "phones"})


class ProviderListing(StaffListingDetail):
    """The staff detail of the provider's own listing, plus the price, so the pay page can show it first."""

    featured_price_naira: Decimal  # sent as a string with 2 decimals, e.g. "5000.00"


class ProviderListingUpdate(ListingUpdate):
    """What a provider may change: the four fields of FR-43, with the same checks as the staff editor.

    Any other field is a 422 (`extra="forbid"` for unknown names, the validator for the staff-only ones).
    """

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def only_the_provider_fields(self) -> Self:
        not_allowed = sorted(self.model_fields_set - PROVIDER_FIELDS)
        if not_allowed:
            raise ValueError(f"a provider cannot change: {', '.join(not_allowed)}")
        return self
