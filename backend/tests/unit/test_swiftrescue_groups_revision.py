"""The "SwiftRescue more groups" revision, read as a file. Requirements: FR-15, FR-33.
Feature specs/2026-10-22-swiftrescue-groups/.

It must follow the last revision in the history, leave one head, only insert and rename display names
(never delete or drop), touch only the categories table, and contain no phone number and no listing
(the owner: staff add verified contacts later).
"""
import re

from alembic.config import Config
from alembic.script import ScriptDirectory

from tests import revision_loader
from tests.revision_loader import BACKEND_FOLDER, load_revision, revision_file

GROUPS = revision_loader.SWIFTRESCUE_GROUPS_REVISION_FILE_PATTERN
LAST_REVISION_BEFORE_THIS_ONE = "a54b67ca04df"  # phone is_whatsapp


def code_without_comments() -> str:
    return re.sub(r"#.*", "", revision_file(GROUPS).read_text())


def test_it_follows_the_last_revision_and_the_history_still_has_one_head() -> None:
    module = load_revision(GROUPS)
    config = Config(str(BACKEND_FOLDER / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_FOLDER / "alembic"))
    config.set_main_option("path_separator", "os")
    scripts = ScriptDirectory.from_config(config)

    assert module.down_revision == LAST_REVISION_BEFORE_THIS_ONE
    assert scripts.get_heads() == [module.revision]


def test_it_lists_the_three_new_categories_and_the_three_renames_written_out() -> None:
    module = load_revision(GROUPS)

    assert [tuple(row) for row in module.NEW_CATEGORIES] == [
        ("Disaster and flooding", "disaster-flooding", True, 14),
        ("Sexual and gender-based violence support", "gbv-support", True, 14),
        ("Mental health crisis support", "mental-health-crisis", True, 14),
    ]
    assert [tuple(row) for row in module.RENAMES] == [
        ("fire", "Fire", "Fire service"),
        ("emergency-unit", "24-hour emergency unit", "Hospital emergency (24 hours)"),
        ("roadside-assistance", "Roadside assistance", "Road accidents"),
    ]


def test_it_inserts_with_on_conflict_do_nothing_and_renames_only_with_a_guard() -> None:
    sql = code_without_comments().upper()
    guarded_rename = "UPDATE CATEGORIES SET NAME = :TO_NAME WHERE SLUG = :SLUG AND NAME = :FROM_NAME"

    assert "ON CONFLICT (SLUG) DO NOTHING" in sql
    # One guarded statement, used by the upgrade and by the downgrade.
    assert sql.count(guarded_rename) == 1
    assert sql.count("UPDATE ") == 1
    assert sql.count("CONNECTION.EXECUTE(RENAME_IF_STILL_NAMED") == 2
    for forbidden in ("DELETE ", "DO UPDATE", "TRUNCATE", "DROP ", "ALTER ", "CREATE TABLE"):
        assert forbidden not in sql, forbidden


def test_it_names_only_the_categories_table_and_holds_no_phone_number_and_no_listing() -> None:
    text = revision_file(GROUPS).read_text()
    other_tables = (
        "listings", "phone_numbers", "opening_hours", "services", "users", "user_reports",
        "audit_entries", "verification_checks",
    )

    assert "categories" in text
    for other_table in other_tables:
        assert other_table not in text, other_table
    assert not re.search(r"\+234|\b0[789]\d{9}\b|phone", text, re.IGNORECASE)
