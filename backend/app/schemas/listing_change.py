"""Shapes of moving and closing a facility, and of its address history. See specs/backend/api-spec.md
section 7, "Phase 8a". Requirements: FR-53, US-20.
"""

from datetime import datetime
from typing import Literal, Self

from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.config import settings

REASON_MIN_LENGTH = 3
REASON_MAX_LENGTH = 200


class ListingMove(BaseModel):
    """The new address. `landmark` changes when sent (`null` clears it). The pin: both values or none."""

    address: str = Field(min_length=3, max_length=200)
    area: str
    landmark: str | None = Field(default=None, max_length=200)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)

    @field_validator("address")
    @classmethod
    def trim_address(cls, address: str) -> str:
        address = address.strip()
        if len(address) < 3:
            raise ValueError("address must have at least 3 characters")
        return address

    @field_validator("landmark")
    @classmethod
    def blank_landmark_means_none(cls, landmark: str | None) -> str | None:
        return landmark.strip() or None if landmark is not None else None

    @field_validator("area")
    @classmethod
    def area_is_in_the_fixed_list(cls, area: str) -> str:
        if area not in settings.areas:
            raise ValueError("area must be one of the areas in /meta")
        return area

    @model_validator(mode="after")
    def the_pin_is_both_values_or_none(self) -> Self:
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("send both latitude and longitude, or neither")
        return self


class MoveResult(BaseModel):
    listing_id: int
    status: str
    changed: list[str]  # address, area, landmark: what the person can read (the pin is not listed)
    pin_needs_setting: bool
    message: str


class ListingClose(BaseModel):
    reason: str = Field(min_length=REASON_MIN_LENGTH, max_length=REASON_MAX_LENGTH)

    @field_validator("reason")
    @classmethod
    def trim_reason(cls, reason: str) -> str:
        reason = reason.strip()
        if len(reason) < REASON_MIN_LENGTH:
            raise ValueError(f"reason must have at least {REASON_MIN_LENGTH} characters")
        return reason


class CloseResult(BaseModel):
    listing_id: int
    status: str
    closed_at: datetime


class AddressHistoryItem(BaseModel):
    changed_at: datetime
    field: Literal["address", "area", "landmark"]
    old_value: str | None
    new_value: str | None
    kind: Literal["move", "edit"]  # a move of this phase, or an older plain edit of the same field
    by: str | None  # the staff member's name; always null for a provider


class AddressHistory(BaseModel):
    items: list[AddressHistoryItem]
