"""Alembic reads the database URL from settings and the tables from SQLModel.

Migrations go through the DIRECT address of the database (DATABASE_URL_DIRECT, else DATABASE_URL):
Neon advises against running them through its pooler. The container runs `alembic upgrade head` at
every start (backend/Dockerfile), so a migration is deployed when the API starts.
"""
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool
from sqlmodel import SQLModel

import app.models  # noqa: F401  (registers all 10 tables)
from app.core.config import settings
from app.core.database_options import CONNECT_ARGS

config = context.config
# A "%" in the address (an encoded password, "%40" for "@") would be read by the config parser as
# the start of a variable: write it twice.
config.set_main_option("sqlalchemy.url", settings.alembic_database_url.replace("%", "%%"))
if config.config_file_name:
    fileConfig(config.config_file_name)
target_metadata = SQLModel.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=settings.alembic_database_url, target_metadata=target_metadata, literal_binds=True
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args=CONNECT_ARGS,
    )
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
