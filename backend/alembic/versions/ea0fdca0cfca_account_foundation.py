"""account foundation

Adds six columns to `users` for sign-up, approval and closing an account (FR-48, FR-49, FR-54), feature
specs/2026-10-23-accounts-and-facility-ownership/ (Phase 2). Additive only: nothing is dropped, retyped or deleted.
- approval_status: text, NOT NULL with the server default 'approved', so every row that exists is approved at once and a copy of the
  old code that does not know the column still makes working users.
- email_verified_at, phone_verified_at: filled with the time of this migration for every existing user, because an admin typed those
  details and the production admin must not be locked out. A person who signs up later starts with both empty.
- signup_note, password_changed_at, closed_at: empty (NULL) for every existing user.
The downgrade drops only these six columns and keeps every user.

Revision ID: ea0fdca0cfca
Revises: c3d71e9b5a20
Create Date: 2026-10-24 16:57:11.646392
"""
from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel  # noqa: F401
from alembic import op


revision: str = 'ea0fdca0cfca'
down_revision: Union[str, None] = 'c3d71e9b5a20'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('approval_status', sqlmodel.sql.sqltypes.AutoString(), server_default='approved', nullable=False))
    op.add_column('users', sa.Column('email_verified_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True))
    op.add_column('users', sa.Column('phone_verified_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True))
    op.add_column('users', sa.Column('signup_note', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.add_column('users', sa.Column('password_changed_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True))
    op.add_column('users', sa.Column('closed_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True))
    # Every user that exists now was made by an admin, the seed or the first-admin command: their email and phone count as confirmed.
    op.execute("UPDATE users SET email_verified_at = now(), phone_verified_at = now()")


def downgrade() -> None:
    op.drop_column('users', 'closed_at')
    op.drop_column('users', 'password_changed_at')
    op.drop_column('users', 'signup_note')
    op.drop_column('users', 'phone_verified_at')
    op.drop_column('users', 'email_verified_at')
    op.drop_column('users', 'approval_status')
