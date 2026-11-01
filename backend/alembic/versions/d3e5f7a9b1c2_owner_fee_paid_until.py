"""owner fee paid until

Adds one nullable column to `facility_owners` (owner fee, FR-50; specs/2026-10-29-owner-fee/, the owner's yes
to question Q8 on 2026-10-29): `paid_until`, the end of the month the owner has paid. It is the 10th table's
only change; no table is added. Every link that is `approved` when this runs is paid until one month from now
(question Q7: a free first month, so nobody who could edit loses access); links in any other state stay empty.
The update only touches rows whose `paid_until` is still empty, so running it again changes nothing. The
downgrade drops only the column.

Revision ID: d3e5f7a9b1c2
Revises: c9d2e4f6a8b0
Create Date: 2026-10-29 12:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel  # noqa: F401
from alembic import op


revision: str = 'd3e5f7a9b1c2'
down_revision: Union[str, None] = 'c9d2e4f6a8b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

GRANDFATHER_APPROVED_LINKS_SQL = """
UPDATE facility_owners
SET paid_until = now() + interval '1 month'
WHERE status = 'approved' AND paid_until IS NULL
"""


def upgrade() -> None:
    op.add_column('facility_owners', sa.Column('paid_until', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True))
    op.execute(GRANDFATHER_APPROVED_LINKS_SQL)


def downgrade() -> None:
    op.drop_column('facility_owners', 'paid_until')
