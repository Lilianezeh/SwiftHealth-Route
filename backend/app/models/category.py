from sqlmodel import Field, SQLModel


class Category(SQLModel, table=True):
    """Table 2: Hospital, Pharmacy, Ambulance... sets the re-check cycle."""
    __tablename__ = "categories"

    id: int | None = Field(default=None, primary_key=True)
    name: str
    slug: str = Field(unique=True, index=True)
    parent_id: int | None = Field(default=None, foreign_key="categories.id")
    is_emergency: bool = False
    recheck_days: int = 45
