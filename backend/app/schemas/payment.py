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
