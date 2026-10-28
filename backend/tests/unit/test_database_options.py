"""Tests for the database connection options in core/database_options.py.

Requirements: NFR-05 (the production database), NFR-06. Spec: specs/2026-10-28-neon-database/.

Neon (the production database since the move from Render) has two kinds of address. The pooled one
goes through PgBouncer in "transaction" mode: a connection is handed to a client for one
transaction only. Two things follow for the psycopg 3 driver:
- psycopg prepares a statement on the server after it has run 5 times (prepare_threshold=5). A
  prepared statement lives in ONE server connection, so behind a transaction pooler it can land
  on another one and fail with "prepared statement does not exist". The safe setting is
  prepare_threshold=None (never prepare on the server), which the psycopg documentation advises
  for PgBouncer.
- A free Neon database suspends its compute after 5 minutes without queries and wakes on the next
  connection, which takes about a second; and an idle connection may have been closed. So: a
  connect timeout long enough for a wake-up, a check of each connection before it is used
  (pool_pre_ping), and a connection that is not kept for ever (pool_recycle).
Alembic uses the direct address (DATABASE_URL_DIRECT), never the pooled one (Neon: "always use
direct connections" for migrations).
"""
import inspect
from pathlib import Path

import psycopg
import pytest
from alembic.config import Config
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.database_options import CONNECT_ARGS, ENGINE_OPTIONS

BACKEND = Path(__file__).resolve().parents[2]


def test_the_driver_never_prepares_statements_on_the_server():
    assert "prepare_threshold" in CONNECT_ARGS
    assert CONNECT_ARGS["prepare_threshold"] is None  # None switches the server-side preparing off


def test_the_connect_timeout_is_long_enough_for_a_database_that_wakes_up():
    # Seconds. A wake-up takes about a second, a slow network a few.
    assert 10 <= CONNECT_ARGS["connect_timeout"] <= 30


def test_a_connection_is_checked_before_use_and_not_kept_for_ever():
    assert ENGINE_OPTIONS["pool_pre_ping"] is True
    # Seconds: shorter than Neon's 5 minutes of idleness, so no connection is kept past it.
    assert 60 <= ENGINE_OPTIONS["pool_recycle"] <= 600
    assert ENGINE_OPTIONS["connect_args"] is CONNECT_ARGS


def test_psycopg_accepts_every_connect_argument_we_pass():
    # `prepare_threshold` is a keyword of psycopg.Connection.connect; `connect_timeout` goes on to
    # libpq. A mistake would otherwise show only in production.
    assert "prepare_threshold" in inspect.signature(psycopg.Connection.connect).parameters
    arguments = {**CONNECT_ARGS, "connect_timeout": 1}
    # Nothing listens on port 1: a refused connection, not a TypeError about an argument.
    with pytest.raises(psycopg.OperationalError):
        psycopg.connect("host=127.0.0.1 port=1 dbname=none user=none", **arguments)


def test_an_async_engine_can_be_made_with_these_options_without_connecting():
    engine = create_async_engine("postgresql+psycopg://ada:pw@localhost:5432/db", **ENGINE_OPTIONS)
    assert engine.dialect.name == "postgresql"
    assert engine.pool._pre_ping is True  # noqa: SLF001  (there is no public getter)


def test_alembic_gets_an_address_with_an_encoded_password_whole():
    # Alembic keeps its address in a config parser, where "%" starts a variable: "%40" (an "@" in a
    # password) would raise an error at start-up unless every "%" is written twice, as
    # alembic/env.py does. This is the same call, with a made-up address.
    address = (
        "postgresql+psycopg://ada:p%40ss%2Fword@ep-quiet-sun-123456.eu-central-1.aws.neon.tech"
        "/swifthealth?sslmode=require"
    )
    config = Config()
    config.set_main_option("sqlalchemy.url", address.replace("%", "%%"))
    assert config.get_main_option("sqlalchemy.url") == address
    assert 'replace("%", "%%")' in (BACKEND / "alembic" / "env.py").read_text()


def test_the_app_engine_and_alembic_use_the_options_and_alembic_uses_the_direct_address():
    database = (BACKEND / "app" / "core" / "database.py").read_text()
    assert "**ENGINE_OPTIONS" in database
    assert "settings.database_url" in database  # the app: the (pooled) DATABASE_URL

    env = (BACKEND / "alembic" / "env.py").read_text()
    assert "settings.alembic_database_url" in env  # migrations: DATABASE_URL_DIRECT if it is set
    assert "settings.database_url" not in env.replace("settings.alembic_database_url", "")
    assert "connect_args=CONNECT_ARGS" in env
