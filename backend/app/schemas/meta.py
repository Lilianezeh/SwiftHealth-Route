"""The answer of GET /meta. See specs/backend/api-spec.md, section 3 (FR-03, FR-05)."""
from pydantic import BaseModel

from app.schemas.listing import Naira


class MetaCategory(BaseModel):
    slug: str
    name: str
    is_emergency: bool


class MetaResponse(BaseModel):
    areas: list[str]
    categories: list[MetaCategory]
    services: list[str]
    blood_groups: list[str]
    report_reasons: list[str]
    service_catalogue: list[str]  # the names staff may pick for a listing (phase 10, decision C1)
    signup_open: bool  # sign-up routes would answer (api-spec 4c); the header shows "Sign up" only then
    featured_price_naira: Naira  # the price of 30 days as featured, "5000.00" (the "For facilities" page)
