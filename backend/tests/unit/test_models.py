from sqlmodel import SQLModel, create_engine

import app.models  # noqa: F401


def test_all_nine_tables_create():
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)
    assert set(SQLModel.metadata.tables) == {
        "users", "categories", "listings", "phone_numbers", "opening_hours", "services",
        "verification_checks", "user_reports", "audit_entries",
    }
