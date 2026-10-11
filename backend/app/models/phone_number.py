from datetime import datetime

from sqlalchemy import false
from sqlmodel import Field, SQLModel


class PhoneNumber(SQLModel, table=True):
    """Table 4: a listing can have several numbers."""
    __tablename__ = "phone_numbers"

    id: int | None = Field(default=None, primary_key=True)
    listing_id: int = Field(foreign_key="listings.id", index=True)
    number: str  # stored as +234...
    label: str | None = None  # Front desk, Emergency...
    is_primary: bool = False
    # True only when staff or the provider said this number is on WhatsApp (FR-10). Never guessed,
    # and never set by the seed or the demo data. The database default makes the migration safe
    # on rows that already exist.
    is_whatsapp: bool = Field(default=False, sa_column_kwargs={"server_default": false()})
    last_working_at: datetime | None = None
