"""The "all spec categories" revision, read as a file. Requirements: FR-05, FR-15, FR-33.

The migration holds its own copy of the 12 rows (an old migration must keep its meaning, so it does not
import the seed). These tests make sure that copy equals the seed today, that it sits at the end of the
revision history, and that its SQL only inserts.
Decisions 2, 3, 4 and 6 in specs/2026-10-10-reference-categories/requirements.md.
"""
import re

from alembic.config import Config
from alembic.script import ScriptDirectory

from seed.seed_data import CATEGORIES
from tests.revision_loader import (
    BACKEND_FOLDER,
    SWIFTRESCUE_GROUPS_REVISION_FILE_PATTERN,
    load_revision,
    revision_file,
)

LAST_REVISION_BEFORE_THIS_ONE = "82a902495666"


def test_migration_list_plus_the_later_revision_equals_the_seed_categories() -> None:
    # This old revision keeps its own 12 rows with the names of its day. The SwiftRescue groups revision
    # (2026-10-22) then renames three and appends three, so the seed must equal: the old rows, with
    # those renames, followed by the new rows.
    later = load_revision(SWIFTRESCUE_GROUPS_REVISION_FILE_PATTERN)
    new_names = {slug: new_name for slug, _old, new_name in later.RENAMES}
    migrated_rows = [
        (slug, new_names.get(slug, name), emergency, days)
        for slug, name, emergency, days in load_revision().CATEGORIES
    ]
    migrated_rows += [
        (slug, name, emergency, days) for name, slug, emergency, days in later.NEW_CATEGORIES
    ]
    seed_rows = [
        (category.slug, category.name, category.is_emergency, category.recheck_days)
        for category in CATEGORIES
    ]

    assert migrated_rows == seed_rows  # same rows, same order (the order decides the ids in a new database)


def test_migration_has_twelve_different_slugs() -> None:
    slugs = [row[0] for row in load_revision().CATEGORIES]

    assert len(slugs) == 12
    assert len(set(slugs)) == 12


def test_emergency_categories_have_14_days_and_the_others_45() -> None:  # FR-33
    rows = load_revision().CATEGORIES

    assert {row[3] for row in rows if row[2]} == {14}
    assert {row[3] for row in rows if not row[2]} == {45}
    # Ambulance, Fire, Police, emergency unit, roadside assistance, security, blood bank
    assert sum(1 for row in rows if row[2]) == 7


def test_migration_follows_the_last_revision_and_the_history_has_one_head() -> None:
    # It was the only head when it was written. The next revision (phone is_whatsapp, FR-47) follows it,
    # so the check is now "one head" and "this revision is in the chain", not "this revision is the head".
    module = load_revision()
    config = Config(str(BACKEND_FOLDER / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_FOLDER / "alembic"))
    config.set_main_option("path_separator", "os")  # silences Alembic's warning about the old default
    scripts = ScriptDirectory.from_config(config)

    assert module.down_revision == LAST_REVISION_BEFORE_THIS_ONE
    assert len(scripts.get_heads()) == 1
    assert module.revision in [script.revision for script in scripts.walk_revisions()]


def test_migration_sql_only_inserts_and_never_updates_or_deletes() -> None:
    code_without_comments = re.sub(r"#.*", "", revision_file().read_text())
    sql_words = code_without_comments.upper()

    assert "ON CONFLICT (SLUG) DO NOTHING" in sql_words
    for forbidden in ("UPDATE ", "DELETE ", "DO UPDATE", "TRUNCATE", "DROP "):
        assert forbidden not in sql_words, forbidden


def test_migration_names_only_the_categories_table() -> None:
    text = revision_file().read_text()

    assert "categories" in text
    other_tables = (
        "listings", "phone_numbers", "opening_hours", "services", "users", "user_reports", "audit_entries",
        "verification_checks",
    )
    for other_table in other_tables:
        assert other_table not in text, other_table
