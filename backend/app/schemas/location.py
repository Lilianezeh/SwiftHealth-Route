"""The caller's location as query parameters, shared by the endpoints that sort by distance.

`lat` and `lng` are a visitor's position (NFR-07): used for this request only, and the access log
redacts them.
"""
from typing import Self

from pydantic import BaseModel, Field, model_validator


class LocationParams(BaseModel):
    lat: float | None = Field(default=None, ge=-90, le=90, description="Caller's latitude. Send with lng.")
    lng: float | None = Field(default=None, ge=-180, le=180, description="Caller's longitude. Send with lat.")

    @model_validator(mode="after")
    def location_needs_both_lat_and_lng(self) -> Self:
        if (self.lat is None) != (self.lng is None):
            raise ValueError("lat and lng must be sent together")
        return self
