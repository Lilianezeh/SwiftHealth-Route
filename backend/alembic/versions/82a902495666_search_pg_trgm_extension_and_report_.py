"""search: pg_trgm extension and report reporter_key

Revision ID: 82a902495666
Revises: f58f6b90a2e4
Create Date: 2026-10-09 10:14:11.280142
"""
from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel  # noqa: F401
from alembic import op


revision: str = '82a902495666'
down_revision: Union[str, None] = 'f58f6b90a2e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Added by hand: Alembic does not detect extensions. pg_trgm is a trusted extension (PostgreSQL docs), so the
    # database owner can create it. It powers the misspelling-tolerant search (FR-04).
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    # Keyed hash of the reporter's phone or IP, to count different reporters for FR-22 (NFR-07: no raw IP).
    op.add_column('user_reports', sa.Column('reporter_key', sqlmodel.sql.sqltypes.AutoString(), nullable=True))


def downgrade() -> None:
    op.drop_column('user_reports', 'reporter_key')
    op.execute("DROP EXTENSION IF EXISTS pg_trgm")
