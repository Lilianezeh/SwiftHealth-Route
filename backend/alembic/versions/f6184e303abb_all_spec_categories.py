"""all spec categories

Data migration: adds the 12 categories of the spec to every database (FR-01, FR-15), so a database that was filled by
the demo step alone (production had only Clinic, Pharmacy and Laboratory) also has the others. Safe to run again: a
category that already exists is left exactly as it is. No other table is read or changed.
Feature: specs/2026-10-10-reference-categories/.

Revision ID: f6184e303abb
Revises: 82a902495666
Create Date: 2026-10-10 15:13:00.454282
"""
from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel  # noqa: F401
from alembic import op


revision: str = 'f6184e303abb'
down_revision: Union[str, None] = '82a902495666'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

EMERGENCY_RECHECK_DAYS = 14  # FR-33: emergency contacts are re-checked every 14 days
OTHER_RECHECK_DAYS = 45  # FR-33: every other place every 45 days

# (slug, name, is_emergency, recheck_days), in the order of seed/seed_data.py. The rows are written out here on purpose:
# an old migration must keep its meaning even if the seed changes later. tests/unit/test_categories_migration_list.py
# fails if the two drift apart.
CATEGORIES = (
    ("hospital", "Hospital", False, OTHER_RECHECK_DAYS),
    ("clinic", "Clinic", False, OTHER_RECHECK_DAYS),
    ("pharmacy", "Pharmacy", False, OTHER_RECHECK_DAYS),
    ("maternity", "Maternity", False, OTHER_RECHECK_DAYS),
    ("laboratory", "Laboratory", False, OTHER_RECHECK_DAYS),
    ("ambulance", "Ambulance", True, EMERGENCY_RECHECK_DAYS),
    ("fire", "Fire", True, EMERGENCY_RECHECK_DAYS),
    ("police", "Police", True, EMERGENCY_RECHECK_DAYS),
    ("emergency-unit", "24-hour emergency unit", True, EMERGENCY_RECHECK_DAYS),
    ("roadside-assistance", "Roadside assistance", True, EMERGENCY_RECHECK_DAYS),
    ("security", "Security", True, EMERGENCY_RECHECK_DAYS),
    ("blood-bank", "Blood bank", True, EMERGENCY_RECHECK_DAYS),
)

# Added by hand: Alembic does not detect data. slug has a unique index (ix_categories_slug), which ON CONFLICT (slug)
# needs.
INSERT_IF_MISSING = sa.text(
    "INSERT INTO categories (name, slug, is_emergency, recheck_days) "
    "VALUES (:name, :slug, :is_emergency, :recheck_days) "
    "ON CONFLICT (slug) DO NOTHING"
)


def upgrade() -> None:
    connection = op.get_bind()
    for slug, name, is_emergency, recheck_days in CATEGORIES:
        connection.execute(
            INSERT_IF_MISSING,
            {"name": name, "slug": slug, "is_emergency": is_emergency, "recheck_days": recheck_days},
        )


def downgrade() -> None:
    # Nothing to do on purpose. Removing categories could leave places without one, and the rows are reference data
    # that is safe to keep. Going back one revision keeps them.
    pass
