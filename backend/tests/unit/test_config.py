"""Tests for the secret checks in core/config.py.
Requirements: FR-30, NFR-06 (no forgeable tokens), FR-22, NFR-07.

Decision 12 in specs/2026-10-05-auth-and-roles/requirements.md (JWT_SECRET) and decision 6 in
specs/2026-10-09-search-backend/requirements.md (REPORTER_KEY_SECRET). Settings is built with `_env_file=None`
and with APP_ENV and both secrets removed from the environment, so neither .env nor the container decides.
"""
import pytest
from pydantic import ValidationError

from app.core.config import DEFAULT_JWT_SECRET, DEFAULT_REPORTER_KEY_SECRET, Settings

A_32_BYTE_SECRET = "x" * 32
A_LONG_RANDOM_SECRET = "q7Zk2vN8rT4mW9bX1cD5fG3hJ6lP0sA2eR7yU4iO8tK1nM5vB3xC"
ANOTHER_LONG_SECRET = "Hp4Wn7cE2uYb9QdK5sZr1TgL8vXa3MjF6oNi0RtB2yUe"


@pytest.fixture(autouse=True)
def clean_environment(monkeypatch):
    monkeypatch.delenv("APP_ENV", raising=False)
    monkeypatch.delenv("JWT_SECRET", raising=False)
    monkeypatch.delenv("REPORTER_KEY_SECRET", raising=False)


def make_settings(**values) -> Settings:
    return Settings(_env_file=None, **values)


def production_settings(**values) -> Settings:
    """Production settings with a good value for each secret, unless the test overrides it."""
    secrets = {"jwt_secret": A_LONG_RANDOM_SECRET, "reporter_key_secret": ANOTHER_LONG_SECRET}
    return make_settings(app_env="production", **{**secrets, **values})


def test_app_env_defaults_to_development():
    assert make_settings().app_env == "development"


def test_development_accepts_the_default_and_a_short_secret():
    assert make_settings().jwt_secret == DEFAULT_JWT_SECRET  # no JWT_SECRET set at all
    assert make_settings(app_env="development", jwt_secret="short").jwt_secret == "short"


def test_production_refuses_a_missing_jwt_secret():
    with pytest.raises(ValidationError, match="JWT_SECRET is missing"):
        make_settings(app_env="production")


def test_production_refuses_an_empty_jwt_secret():
    with pytest.raises(ValidationError, match="JWT_SECRET is missing"):
        make_settings(app_env="production", jwt_secret="")


def test_production_refuses_the_default_jwt_secret():
    with pytest.raises(ValidationError, match="development default"):
        make_settings(app_env="production", jwt_secret=DEFAULT_JWT_SECRET)


def test_production_refuses_a_secret_under_32_bytes():
    with pytest.raises(ValidationError, match="31 bytes"):
        make_settings(app_env="production", jwt_secret="x" * 31)
    assert production_settings(jwt_secret=A_32_BYTE_SECRET).jwt_secret == A_32_BYTE_SECRET


def test_the_length_is_counted_in_bytes():
    # 20 characters, 40 bytes: long enough. And 16 two-byte characters are 32 bytes: just long enough.
    assert production_settings(jwt_secret="é" * 20)
    assert production_settings(jwt_secret="é" * 16)
    with pytest.raises(ValidationError, match="30 bytes"):
        production_settings(jwt_secret="é" * 15)


@pytest.mark.parametrize("app_env", ["staging", "prod", "Development", "production"])
def test_any_app_env_other_than_development_is_checked(app_env):
    with pytest.raises(ValidationError, match="JWT_SECRET"):
        make_settings(app_env=app_env, jwt_secret=DEFAULT_JWT_SECRET)


def test_a_long_random_secret_is_accepted_in_production():
    settings = production_settings()
    assert settings.app_env == "production"


def test_the_error_never_contains_the_secret():
    too_short_secret = "marker-secret-abc"
    with pytest.raises(ValidationError) as error:
        make_settings(app_env="production", jwt_secret=too_short_secret)
    assert too_short_secret not in str(error.value)


# --- REPORTER_KEY_SECRET: counts different reporters for FR-22 (decision 6) ---


def test_production_refuses_a_missing_reporter_key_secret():
    with pytest.raises(ValidationError, match="REPORTER_KEY_SECRET is missing"):
        make_settings(app_env="production", jwt_secret=A_LONG_RANDOM_SECRET)


def test_production_refuses_an_empty_reporter_key_secret():
    with pytest.raises(ValidationError, match="REPORTER_KEY_SECRET is missing"):
        production_settings(reporter_key_secret="")


def test_production_refuses_the_default_reporter_key_secret():
    with pytest.raises(ValidationError, match="REPORTER_KEY_SECRET is missing or is still the development"):
        production_settings(reporter_key_secret=DEFAULT_REPORTER_KEY_SECRET)


def test_production_refuses_a_reporter_key_secret_under_32_bytes():
    with pytest.raises(ValidationError, match="REPORTER_KEY_SECRET is only 31 bytes"):
        production_settings(reporter_key_secret="x" * 31)
    assert production_settings(reporter_key_secret=A_32_BYTE_SECRET).reporter_key_secret == A_32_BYTE_SECRET


def test_the_reporter_key_error_never_contains_the_secret():
    too_short_secret = "marker-reporter-abc"
    with pytest.raises(ValidationError) as error:
        production_settings(reporter_key_secret=too_short_secret)
    assert too_short_secret not in str(error.value)


def test_development_accepts_a_blank_reporter_key_secret():
    # .env.example has a blank REPORTER_KEY_SECRET: development then uses the public development default.
    assert make_settings().reporter_key_secret == DEFAULT_REPORTER_KEY_SECRET
    assert make_settings(reporter_key_secret="").reporter_key_secret == DEFAULT_REPORTER_KEY_SECRET
    assert make_settings(reporter_key_secret="short").reporter_key_secret == "short"


def test_either_secret_bad_is_refused_in_production():
    # A good JWT_SECRET does not excuse a bad REPORTER_KEY_SECRET, and the reverse.
    with pytest.raises(ValidationError, match="REPORTER_KEY_SECRET"):
        production_settings(reporter_key_secret="short")
    with pytest.raises(ValidationError, match="JWT_SECRET"):
        production_settings(jwt_secret="short")


def test_one_error_names_every_bad_secret():
    with pytest.raises(ValidationError) as error:
        make_settings(app_env="production")
    assert "JWT_SECRET" in str(error.value)
    assert "REPORTER_KEY_SECRET" in str(error.value)


def test_the_two_secrets_may_not_be_the_same_value():
    # One leaked value must not open both. The login-code hash and the reporter keys stay independent.
    with pytest.raises(ValidationError, match="REPORTER_KEY_SECRET must differ from JWT_SECRET"):
        production_settings(reporter_key_secret=A_LONG_RANDOM_SECRET)


def test_reporter_key_secret_is_read_from_the_environment(monkeypatch):
    monkeypatch.setenv("REPORTER_KEY_SECRET", ANOTHER_LONG_SECRET)
    assert make_settings().reporter_key_secret == ANOTHER_LONG_SECRET


def test_database_url_with_plain_postgresql_prefix_gets_the_psycopg_driver():
    # Render gives `postgresql://...`; our engine needs the psycopg 3 driver in the address (NFR-05, NFR-06).
    settings = make_settings(database_url="postgresql://user:secret@host:5432/dbname")
    assert settings.database_url == "postgresql+psycopg://user:secret@host:5432/dbname"


def test_database_url_that_names_psycopg_is_left_alone():
    address = "postgresql+psycopg://user:secret@host:5432/dbname"
    assert make_settings(database_url=address).database_url == address


def test_database_url_rewrite_keeps_user_password_host_and_database():
    # Only the start of the address changes. An encoded password and a query string must survive.
    settings = make_settings(database_url="postgresql://ada:p%40ss@db.example.com:6543/clinic?sslmode=require")
    assert settings.database_url == "postgresql+psycopg://ada:p%40ss@db.example.com:6543/clinic?sslmode=require"


def test_database_url_that_names_another_driver_is_left_alone():
    address = "postgresql+asyncpg://user:secret@host:5432/dbname"
    assert make_settings(database_url=address).database_url == address


def test_database_url_is_rewritten_when_it_comes_from_the_environment(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:secret@host:5432/dbname")
    assert make_settings().database_url == "postgresql+psycopg://user:secret@host:5432/dbname"


def test_cors_origin_list_splits_a_comma_list_and_trims_spaces():
    settings = make_settings(cors_origins="https://swifthealth.netlify.app, http://localhost:3000")
    assert settings.cors_origin_list == ["https://swifthealth.netlify.app", "http://localhost:3000"]


def test_app_env_is_read_from_the_environment(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    with pytest.raises(ValidationError, match="JWT_SECRET"):
        make_settings()  # APP_ENV=production, no JWT_SECRET
    monkeypatch.setenv("JWT_SECRET", A_LONG_RANDOM_SECRET)
    monkeypatch.setenv("REPORTER_KEY_SECRET", ANOTHER_LONG_SECRET)
    assert make_settings().app_env == "production"
