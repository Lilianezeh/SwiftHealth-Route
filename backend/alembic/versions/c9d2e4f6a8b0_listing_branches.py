"""listing branches

Adds one nullable column to `listings` (accounts phase 8b, FR-52): `parent_id`, a foreign key to `listings.id`
with an index. A branch points to its main facility; every existing listing keeps NULL, so every existing
listing is a main facility and no row is rewritten. Additive only. The downgrade drops the index and the
column and nothing else.

Revision ID: c9d2e4f6a8b0
Revises: b8a1c3d5e7f9
Create Date: 2026-10-27 15:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = 'c9d2e4f6a8b0'
down_revision: Union[str, None] = 'b8a1c3d5e7f9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('listings', sa.Column('parent_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_listings_parent_id', 'listings', 'listings', ['parent_id'], ['id'])
    op.create_index(op.f('ix_listings_parent_id'), 'listings', ['parent_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_listings_parent_id'), table_name='listings')
    op.drop_constraint('fk_listings_parent_id', 'listings', type_='foreignkey')
    op.drop_column('listings', 'parent_id')
