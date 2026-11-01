"""Shapes of the payment endpoints. See specs/backend/api-spec.md, section 8 ("Phase 12 rules").
Requirements: FR-44, FR-46. Decisions I3 to I10 in specs/2026-10-20-providers-payments/requirements.md.
Money is a Decimal in the code and a string with 2 decimals in JSON (CLAUDE.md).
"""

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict


class FeaturedRequest(BaseModel):
    """Only the monthly plan exists; the provider cannot choose the amount, so nothing else is accepted."""

    model_config = ConfigDict(extra="forbid")

    plan: Literal["monthly"]


class FeaturedStarted(BaseModel):
    authorization_url: str
    reference: str
    amount_naira: Decimal  # "5000.00"


class PaymentVerified(BaseModel):
    status: Literal["success", "pending"]
    featured_until: datetime | None


class WebhookReceived(BaseModel):
    status: Literal["ok"]


# --- the owner fee (specs/2026-10-29-owner-fee/) ---

class OwnerFeeRequest(BaseModel):
    """Which link to pay for. The amount is the setting OWNER_FEE_NAIRA: the provider cannot choose it."""

    model_config = ConfigDict(extra="forbid")

    link_id: int


class OwnerFeeStarted(BaseModel):
    authorization_url: str
    reference: str
    amount_naira: Decimal  # "10000.00"


class OwnerFeeVerified(BaseModel):
    status: Literal["success", "pending"]
    link_status: str
    paid_until: datetime | None


class PaymentListItem(BaseModel):
    reference: str
    kind: Literal["owner_fee"]
    listing_id: int
    listing_name: str
    paid_at: datetime
    paid_until: datetime | None


class PaymentList(BaseModel):
    items: list[PaymentListItem]


class LinkCancelled(BaseModel):
    """What cancelling a link did. `access_until` is set when editing goes on to the end of the paid month;
    `refund` is "done" or "pending" when a payment is given back, else null."""

    link_id: int
    status: str
    access_until: datetime | None
    refund: Literal["done", "pending"] | None
