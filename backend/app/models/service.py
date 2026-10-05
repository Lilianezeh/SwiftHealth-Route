from datetime import date
from decimal import Decimal

from sqlmodel import Field, SQLModel


class Service(SQLModel, table=True):
    """Table 6: services offered, with an estimated fee range and the date it was collected."""
    __tablename__ = "services"

    id: int | None = Field(default=None, primary_key=True)
    listing_id: int = Field(foreign_key="listings.id", index=True)
    name: str = Field(index=True)
    # Money is always Decimal (never float) so amounts are exact, e.g. 1500.00
    fee_min_naira: Decimal | None = Field(default=None, max_digits=12, decimal_places=2)
    fee_max_naira: Decimal | None = Field(default=None, max_digits=12, decimal_places=2)
    fee_collected_at: date | None = None
