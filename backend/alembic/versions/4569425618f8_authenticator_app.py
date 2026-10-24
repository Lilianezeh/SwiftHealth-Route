"""authenticator app

Adds four nullable columns to `users` for the authenticator app (FR-58), feature
specs/2026-10-23-accounts-and-facility-ownership/ (Phase 2c). Additive only: nothing is dropped, retyped or filled.
- totp_secret: the secret, stored ENCRYPTED by the API (core/secret_box.py); empty until a person starts the set-up.
- totp_enabled_at: when the set-up was finished (a first code from the app was right); empty means the app is not switched on.
- totp_last_step: the last accepted 30-second step, so a code works once.
- backup_code_hashes: a JSON list of keyed hashes of the unused backup codes.
Every existing user has all four empty, so every login works exactly as before. The downgrade drops only these four columns.

Revision ID: 4569425618f8
Revises: ea0fdca0cfca
Create Date: 2026-10-24 19:17:11.644074
"""
from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel  # noqa: F401
from alembic import op


revision: str = '4569425618f8'
down_revision: Union[str, None] = 'ea0fdca0cfca'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('totp_secret', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.add_column('users', sa.Column('totp_enabled_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True))
    op.add_column('users', sa.Column('totp_last_step', sa.Integer(), nullable=True))
    op.add_column('users', sa.Column('backup_code_hashes', sqlmodel.sql.sqltypes.AutoString(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'backup_code_hashes')
    op.drop_column('users', 'totp_last_step')
    op.drop_column('users', 'totp_enabled_at')
    op.drop_column('users', 'totp_secret')
