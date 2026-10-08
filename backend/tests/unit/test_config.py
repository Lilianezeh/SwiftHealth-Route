"""Tests for the JWT secret check in core/config.py. Requirements: FR-30, NFR-06 (no forgeable tokens).

Decision 12 in specs/2026-10-05-auth-and-roles/requirements.md. Settings is built with `_env_file=None`
and with APP_ENV and JWT_SECRET removed from the environment, so neither .env nor the container decides.
"""
import pytest
from pydantic import ValidationError

from app.core.config import DEFAULT_JWT_SECRET, Settings

A_32_BYTE_SECRET = "x" * 32
A_LONG_RANDOM_SECRET = "q7Zk2vN8rT4mW9bX1cD5fG3hJ6lP0sA2eR7yU4iO8tK1nM5vB3xC"


@pytest.fixture(autouse=True)
def clean_environment(monkeypatch):
    monkeypatch.delenv("APP_ENV", raising=False)
    monkeypatch.delenv("JWT_SECRET", raising=False)


def make_settings(**values) -> Settings:
    return Settings(_env_file=None, **values)


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
    assert make_settings(app_env="production", jwt_secret=A_32_BYTE_SECRET).jwt_secret == A_32_BYTE_SECRET


def test_the_length_is_counted_in_bytes():
    # 20 characters, 40 bytes: long enough. And 16 two-byte characters are 32 bytes: just long enough.
    assert make_settings(app_env="production", jwt_secret="é" * 20)
    assert make_settings(app_env="production", jwt_secret="é" * 16)
    with pytest.raises(ValidationError, match="30 bytes"):
        make_settings(app_env="production", jwt_secret="é" * 15)


@pytest.mark.parametrize("app_env", ["staging", "prod", "Development", "production"])
def test_any_app_env_other_than_development_is_checked(app_env):
    with pytest.raises(ValidationError, match="JWT_SECRET"):
        make_settings(app_env=app_env, jwt_secret=DEFAULT_JWT_SECRET)


def test_a_long_random_secret_is_accepted_in_production():
    settings = make_settings(app_env="production", jwt_secret=A_LONG_RANDOM_SECRET)
    assert settings.app_env == "production"


def test_the_error_never_contains_the_secret():
    too_short_secret = "marker-secret-abc"
    with pytest.raises(ValidationError) as error:
        make_settings(app_env="production", jwt_secret=too_short_secret)
    assert too_short_secret not in str(error.value)


def test_app_env_is_read_from_the_environment(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    with pytest.raises(ValidationError, match="JWT_SECRET"):
        make_settings()  # APP_ENV=production, no JWT_SECRET
    monkeypatch.setenv("JWT_SECRET", A_LONG_RANDOM_SECRET)
    assert make_settings().app_env == "production"
