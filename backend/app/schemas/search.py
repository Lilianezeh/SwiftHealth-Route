"""Query parameters and response for GET /search. See specs/backend/api-spec.md section 3 (FR-04 to FR-08)."""
from typing import Self

from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.config import settings
from app.schemas.listing import ListingSummary

MAX_TEXT_LENGTH = 100  # a very long string would only slow the text match down
MAX_RADIUS_KM = 50
MAX_LIMIT = 100


class SearchParams(BaseModel):
    q: str | None = Field(default=None, max_length=MAX_TEXT_LENGTH)
    category: str | None = Field(default=None, max_length=MAX_TEXT_LENGTH)
    service: str | None = Field(default=None, max_length=MAX_TEXT_LENGTH)
    area: str | None = None
    open_now: bool = False
    is_24_hours: bool = False
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    radius_km: float = Field(default=10, gt=0, le=MAX_RADIUS_KM)
    limit: int = Field(default=20, ge=1, le=MAX_LIMIT)
    offset: int = Field(default=0, ge=0)

    @field_validator("q", "category", "service")
    @classmethod
    def blank_text_means_not_given(cls, text: str | None) -> str | None:
        """`?q=` and `?q=%20` are the same as no `q` at all."""
        return text.strip() or None if text is not None else None

    @field_validator("area")
    @classmethod
    def area_must_be_in_the_fixed_list(cls, area: str | None) -> str | None:
        if area is not None and area not in settings.areas:
            raise ValueError("area must be one of the areas in /meta")
        return area

    @model_validator(mode="after")
    def location_needs_both_lat_and_lng(self) -> Self:
        if (self.lat is None) != (self.lng is None):
            raise ValueError("lat and lng must be sent together")
        return self


class SearchResponse(BaseModel):
    items: list[ListingSummary]
    total: int
