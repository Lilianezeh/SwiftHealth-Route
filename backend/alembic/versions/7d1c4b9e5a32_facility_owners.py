"""facility owners

Creates the 10th table, `facility_owners` (accounts phase 6, FR-50; the owner's yes to decision D1 on
2026-10-24), and copies every existing `listings.owner_id` into it once as an approved `owner` link, so nobody
who could edit a listing before loses access. Additive only: no column is dropped, retyped or filled, and
`listings.owner_id` stays where it is, untouched, and is no longer read by the code. The copy uses
ON CONFLICT DO NOTHING on the unique pair (listing, person), so running it again adds nothing. The downgrade
drops only the new table.

Revision ID: 7d1c4b9e5a32
Revises: 4569425618f8
Create Date: 2026-10-27 09:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel  # noqa: F401
from alembic import op


revision: str = '7d1c4b9e5a32'
down_revision: Union[str, None] = '4569425618f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# One approved owner link for every listing that has an owner_id. Safe to run twice.
COPY_EXISTING_OWNERS_SQL = """
INSERT INTO facility_owners (listing_id, user_id, role, status, requested_at, approved_at, note)
SELECT id, owner_id, 'owner', 'approved', now(), now(), 'migrated from listings.owner_id'
FROM listings
WHERE owner_id IS NOT NULL
ON CONFLICT (listing_id, user_id) DO NOTHING
"""


def upgrade() -> None:
    op.create_table(
        'facility_owners',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('listing_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('role', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('requested_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
        sa.Column('approved_by', sa.Integer(), nullable=True),
        sa.Column('approved_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True),
        sa.Column('removed_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True),
        sa.Column('removed_by', sa.Integer(), nullable=True),
        sa.Column('note', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.ForeignKeyConstraint(['approved_by'], ['users.id']),
        sa.ForeignKeyConstraint(['listing_id'], ['listings.id']),
        sa.ForeignKeyConstraint(['removed_by'], ['users.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('listing_id', 'user_id', name='uq_facility_owners_listing_user'),
    )
    op.create_index(op.f('ix_facility_owners_listing_id'), 'facility_owners', ['listing_id'], unique=False)
    op.create_index(op.f('ix_facility_owners_user_id'), 'facility_owners', ['user_id'], unique=False)
    op.create_index(op.f('ix_facility_owners_status'), 'facility_owners', ['status'], unique=False)
    op.execute(COPY_EXISTING_OWNERS_SQL)


def downgrade() -> None:
    op.drop_index(op.f('ix_facility_owners_status'), table_name='facility_owners')
    op.drop_index(op.f('ix_facility_owners_user_id'), table_name='facility_owners')
    op.drop_index(op.f('ix_facility_owners_listing_id'), table_name='facility_owners')
    op.drop_table('facility_owners')
