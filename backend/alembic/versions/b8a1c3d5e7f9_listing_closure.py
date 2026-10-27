"""listing closure

Adds two nullable columns to `listings` (accounts phase 8a, FR-53): `closed_at` and `closed_reason`. A closed
facility is a hidden listing with these set; no status value is added and no row is rewritten, so every
existing listing keeps both columns empty. Additive only. The downgrade drops only these two columns.

Revision ID: b8a1c3d5e7f9
Revises: 7d1c4b9e5a32
Create Date: 2026-10-27 12:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel  # noqa: F401
from alembic import op


revision: str = 'b8a1c3d5e7f9'
down_revision: Union[str, None] = '7d1c4b9e5a32'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('listings', sa.Column('closed_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True))
    op.add_column(
        'listings', sa.Column('closed_reason', sqlmodel.sql.sqltypes.AutoString(length=200), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('listings', 'closed_reason')
    op.drop_column('listings', 'closed_at')
