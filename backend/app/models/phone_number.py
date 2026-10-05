from datetime import datetime

from sqlmodel import Field, SQLModel


class PhoneNumber(SQLModel, table=True):
    """Table 4: a listing can have several numbers."""
    __tablename__ = "phone_numbers"

    id: int | None = Field(default=None, primary_key=True)
    listing_id: int = Field(foreign_key="listings.id", index=True)
    number: str  # stored as +234...
    label: str | None = None  # Front desk, Emergency...
    is_primary: bool = False
    last_working_at: datetime | None = None
