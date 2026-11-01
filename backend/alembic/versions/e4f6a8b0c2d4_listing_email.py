"""listing email

Adds one nullable column to `listings` (the facility owner form, US-17; specs/2026-11-01-owner-form-fields/,
the owner's yes to decision 3 on 2026-11-01): `email`, the facility's contact address for staff. It is never in a
public answer. No table is added or merged. Every existing listing keeps an empty email. The downgrade drops only
the column.

Revision ID: e4f6a8b0c2d4
Revises: d3e5f7a9b1c2
Create Date: 2026-11-01 14:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel  # noqa: F401
from alembic import op


revision: str = 'e4f6a8b0c2d4'
down_revision: Union[str, None] = 'd3e5f7a9b1c2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('listings', sa.Column('email', sqlmodel.sql.sqltypes.AutoString(), nullable=True))


def downgrade() -> None:
    op.drop_column('listings', 'email')
