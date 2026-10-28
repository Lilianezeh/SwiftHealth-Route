"""Tests for render.yaml, the Render Blueprint, after the move of the database to Neon.

Requirements: NFR-05, NFR-06 (no secret in the repository). Spec: specs/2026-10-28-neon-database/.

The Blueprint is at the root of the repository. A test run inside the backend container does not
see it (only ./backend is mounted), so those tests are skipped there; they run in CI, and in the
container when the file is mounted at /render.yaml.
"""
import re
from pathlib import Path

import pytest
import yaml

BLUEPRINT = Path(__file__).parents[3] / "render.yaml"

pytestmark = pytest.mark.skipif(not BLUEPRINT.exists(), reason="render.yaml is not mounted here")


@pytest.fixture(scope="module")
def blueprint() -> dict:
    return yaml.safe_load(BLUEPRINT.read_text())


def env_vars(blueprint: dict) -> dict[str, dict]:
    service = next(item for item in blueprint["services"] if item["name"] == "swifthealth-api")
    return {entry["key"]: entry for entry in service["envVars"]}


def test_database_url_is_a_secret_set_by_hand_not_a_link_to_a_render_database(blueprint):
    entry = env_vars(blueprint)["DATABASE_URL"]
    assert entry == {"key": "DATABASE_URL", "sync": False}  # no value, no fromDatabase, no generateValue


def test_the_direct_address_for_alembic_is_a_secret_set_by_hand_too(blueprint):
    entry = env_vars(blueprint)["DATABASE_URL_DIRECT"]
    assert entry == {"key": "DATABASE_URL_DIRECT", "sync": False}


def test_no_database_address_or_password_is_written_in_the_file():
    text = BLUEPRINT.read_text()
    assert not re.search(r"postgres(ql)?(\+\w+)?://\S+@", text)  # an address with a user and a password
    assert "neon.tech" not in text  # the host of a Neon address is the project's name: kept out too


def test_the_render_database_is_still_declared_so_the_move_cannot_delete_it(blueprint):
    # The Blueprint spec does not say what removing a database from the file does. It stays until
    # it expires (about 2026-11-07), as the way back; the API does not use it.
    databases = {database["name"]: database for database in blueprint["databases"]}
    assert databases["swifthealth-db"]["plan"] == "free"
    assert databases["swifthealth-db"]["region"] == "frankfurt"
    assert databases["swifthealth-db"]["ipAllowList"] == []  # no outside connection by default


def test_the_other_variables_of_the_api_are_as_they_were(blueprint):
    variables = env_vars(blueprint)
    assert set(variables) == {
        "APP_ENV", "DATABASE_URL", "DATABASE_URL_DIRECT", "JWT_SECRET", "SEED_DEMO_LISTINGS",
        "REMOVE_DEMO_LISTINGS", "REPORTER_KEY_SECRET", "CORS_ORIGINS", "TRUSTED_PROXY_COUNT",
    }
    assert variables["JWT_SECRET"]["generateValue"] is True
    assert variables["REPORTER_KEY_SECRET"]["generateValue"] is True
    assert variables["APP_ENV"]["value"] == "production"
    assert variables["CORS_ORIGINS"]["value"] == "https://swifthealth-ng.netlify.app"
    assert variables["TRUSTED_PROXY_COUNT"]["value"] == "3"
