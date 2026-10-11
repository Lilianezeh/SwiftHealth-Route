"""phone is_whatsapp

Adds the is_whatsapp flag to phone numbers (FR-10): true only when staff or the provider said the number is on WhatsApp.
The server default is false, so the rows that already exist (production has demo rows) become false and the column can be
NOT NULL on a filled table. No seed or demo number is ever set to true. Safe to downgrade: it drops the column only.
Feature: specs/2026-10-11-listing-detail-api/ (decision 10).

Revision ID: a54b67ca04df
Revises: f6184e303abb
Create Date: 2026-10-11 11:50:28.045246
"""
from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel  # noqa: F401
from alembic import op


revision: str = 'a54b67ca04df'
down_revision: Union[str, None] = 'f6184e303abb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('phone_numbers', sa.Column('is_whatsapp', sa.Boolean(), server_default=sa.false(), nullable=False))


def downgrade() -> None:
    op.drop_column('phone_numbers', 'is_whatsapp')
