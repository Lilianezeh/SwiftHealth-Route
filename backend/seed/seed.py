"""Seed realistic Enugu demo data. Run: python -m seed.seed

TODO (day 3): add categories, one user per role, and 30+ demo listings with
numbers, hours (include some past-midnight pharmacies), services and fees.
Demo data must be clearly fictional: do not use real facilities' phone numbers.
"""
from sqlmodel import Session

from app.core.database import engine


def run() -> None:
    with Session(engine) as session:
        # TODO: create categories, users, listings...
        session.commit()
    print("Seed complete")


if __name__ == "__main__":
    run()
