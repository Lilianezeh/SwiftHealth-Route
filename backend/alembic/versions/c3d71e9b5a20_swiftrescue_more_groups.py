"""swiftrescue more groups

Data migration (FR-15, FR-33), feature specs/2026-10-22-swiftrescue-groups/, owner's answers of 2026-10-22:
- adds three emergency categories: Disaster and flooding, Sexual and gender-based violence support, Mental health crisis support
  (re-checked every 14 days like every emergency category). A category that already exists is left exactly as it is.
- renames the display names of three existing categories: fire -> "Fire service", emergency-unit -> "Hospital emergency (24 hours)",
  roadside-assistance -> "Road accidents". Ids and slugs stay, so every place keeps its category. A name is changed only while it still has
  its old value, so a name that staff already changed by hand is never overwritten.
Nothing is deleted. No other table is read or changed. Safe to run again.

Revision ID: c3d71e9b5a20
Revises: a54b67ca04df
Create Date: 2026-10-22 16:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel  # noqa: F401
from alembic import op


revision: str = 'c3d71e9b5a20'
down_revision: Union[str, None] = 'a54b67ca04df'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

EMERGENCY_RECHECK_DAYS = 14  # FR-33: emergency contacts are re-checked every 14 days

# (name, slug, is_emergency, recheck_days), in the order of seed/seed_data.py (after Blood bank). Written out here on purpose: an old
# migration must keep its meaning even if the seed changes later. tests/unit/test_categories_migration_list.py fails if they drift apart.
NEW_CATEGORIES = (
    ("Disaster and flooding", "disaster-flooding", True, EMERGENCY_RECHECK_DAYS),
    ("Sexual and gender-based violence support", "gbv-support", True, EMERGENCY_RECHECK_DAYS),
    ("Mental health crisis support", "mental-health-crisis", True, EMERGENCY_RECHECK_DAYS),
)

# (slug, old name, new name)
RENAMES = (
    ("fire", "Fire", "Fire service"),
    ("emergency-unit", "24-hour emergency unit", "Hospital emergency (24 hours)"),
    ("roadside-assistance", "Roadside assistance", "Road accidents"),
)

# Added by hand: Alembic does not detect data. slug has a unique index (ix_categories_slug), which ON CONFLICT (slug) needs.
INSERT_IF_MISSING = sa.text(
    "INSERT INTO categories (name, slug, is_emergency, recheck_days) "
    "VALUES (:name, :slug, :is_emergency, :recheck_days) "
    "ON CONFLICT (slug) DO NOTHING"
)
RENAME_IF_STILL_NAMED = sa.text("UPDATE categories SET name = :to_name WHERE slug = :slug AND name = :from_name")


def upgrade() -> None:
    connection = op.get_bind()
    for name, slug, is_emergency, recheck_days in NEW_CATEGORIES:
        connection.execute(
            INSERT_IF_MISSING,
            {"name": name, "slug": slug, "is_emergency": is_emergency, "recheck_days": recheck_days},
        )
    for slug, old_name, new_name in RENAMES:
        connection.execute(RENAME_IF_STILL_NAMED, {"slug": slug, "from_name": old_name, "to_name": new_name})


def downgrade() -> None:
    # The old names come back. The three new categories are kept on purpose: removing them could leave places without a category, and the
    # rows are reference data that is safe to keep. Nothing is deleted.
    connection = op.get_bind()
    for slug, old_name, new_name in RENAMES:
        connection.execute(RENAME_IF_STILL_NAMED, {"slug": slug, "from_name": new_name, "to_name": old_name})
