from datetime import time

from sqlmodel import Field, SQLModel


class OpeningHours(SQLModel, table=True):
    """Table 5: one row per day. closes_at earlier than opens_at means it runs past midnight."""
    __tablename__ = "opening_hours"

    id: int | None = Field(default=None, primary_key=True)
    listing_id: int = Field(foreign_key="listings.id", index=True)
    day_of_week: int = Field(ge=0, le=6)  # 0 = Monday (Python weekday)
    opens_at: time | None = None
    closes_at: time | None = None
    is_closed: bool = False
