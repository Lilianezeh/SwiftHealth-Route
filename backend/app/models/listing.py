from datetime import datetime

from sqlmodel import Field, SQLModel

from app.models.base import ListingStatus, utcnow


class Listing(SQLModel, table=True):
    """Table 3: a health facility or emergency contact."""
    __tablename__ = "listings"

    id: int | None = Field(default=None, primary_key=True)
    slug: str = Field(unique=True, index=True)
    name: str = Field(index=True)
    category_id: int = Field(foreign_key="categories.id", index=True)
    area: str = Field(index=True)  # one of settings.areas
    address: str
    landmark: str | None = None
    latitude: float
    longitude: float
    description: str | None = None
    status: ListingStatus = Field(default=ListingStatus.draft, index=True)
    is_24_hours: bool = False
    entrance_photo_url: str | None = None  # Cloudinary
    owner_id: int | None = Field(default=None, foreign_key="users.id")  # provider who owns it
    created_by: int | None = Field(default=None, foreign_key="users.id")  # verifier who added it
    featured_until: datetime | None = None  # set by Paystack webhook
    last_verified_at: datetime | None = None
    next_check_due: datetime | None = Field(default=None, index=True)
    # The main facility this listing is a branch of (accounts phase 8b, FR-52). One level only; NULL for every
    # main facility, which is every listing that existed before this column.
    parent_id: int | None = Field(default=None, foreign_key="listings.id", index=True)
    # A closed listing is a hidden one with these two set (accounts phase 8a, FR-53). Nothing is deleted.
    closed_at: datetime | None = None
    closed_reason: str | None = Field(default=None, max_length=200)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
