"""The first admin at start-up: `python -m app.bootstrap_admin --at-startup`, run by the Dockerfile.
Requirements: FR-41, FR-30, NFR-06, NFR-07. Task 4b of specs/2026-10-20-launch-readiness/ and
specs/2026-10-21-bootstrap-admin-at-startup/. Same pattern as the demo listings step: it does nothing
unless all four BOOTSTRAP_ADMIN_* variables are set, and it never stops the API from starting.
Every name, address and number is fictional.
"""

import logging
from pathlib import Path

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.bootstrap_admin import run_at_startup
from app.core.security import verify_password
from app.models import AuditEntry, User
from app.models.base import Role
from tests.conftest import TEST_DATABASE_URL

pytestmark = pytest.mark.anyio

PASSWORD = "a-long-enough-password"
EMAIL = "first.admin@example.com"
GOOD = {
    "BOOTSTRAP_ADMIN_NAME": "First Admin",
    "BOOTSTRAP_ADMIN_EMAIL": EMAIL,
    "BOOTSTRAP_ADMIN_PHONE": "0803 000 0000",
    "BOOTSTRAP_ADMIN_PASSWORD": PASSWORD,
}
LOGGER = "app.bootstrap_admin"


@pytest.fixture
async def factory(session: AsyncSession):
    """A session factory on the test database (the `session` fixture has just emptied it)."""
    engine = create_async_engine(TEST_DATABASE_URL)
    yield async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    await engine.dispose()


async def users(session: AsyncSession) -> list[User]:
    return list((await session.exec(select(User))).all())


def messages(caplog: pytest.LogCaptureFixture) -> list[str]:
    return [record.getMessage() for record in caplog.records if record.name == LOGGER]


def assert_nothing_secret_in_the_log(caplog: pytest.LogCaptureFixture) -> None:
    everything = caplog.text + " ".join(str(record.args) for record in caplog.records)
    assert PASSWORD not in everything
    assert EMAIL not in everything
    assert "0803" not in everything


async def test_with_all_four_variables_it_creates_the_admin_and_logs_only_that(
    session: AsyncSession, factory, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.DEBUG)

    await run_at_startup(GOOD, factory)

    [user] = await users(session)
    assert (user.email, user.role, user.is_active) == (EMAIL, Role.admin, True)
    assert verify_password(PASSWORD, user.password_hash)
    assert messages(caplog) == ["first admin created"]
    assert_nothing_secret_in_the_log(caplog)
    [entry] = (await session.exec(select(AuditEntry))).all()
    assert entry.reference == "bootstrap-admin"


async def test_if_the_email_already_exists_it_changes_nothing_and_says_so(
    session: AsyncSession, factory, caplog: pytest.LogCaptureFixture
) -> None:
    await run_at_startup(GOOD, factory)
    caplog.clear()
    caplog.set_level(logging.DEBUG)

    await run_at_startup(
        {**GOOD, "BOOTSTRAP_ADMIN_PASSWORD": "another-long-password", "BOOTSTRAP_ADMIN_NAME": "Other"},
        factory,
    )

    [user] = await users(session)
    assert user.name == "First Admin"
    assert verify_password(PASSWORD, user.password_hash)  # the password was not overwritten
    assert messages(caplog) == ["admin already exists"]
    assert "another-long-password" not in caplog.text
    assert len((await session.exec(select(AuditEntry))).all()) == 1  # no second audit entry


async def test_it_is_safe_on_every_restart_while_the_variables_stay_set(
    session: AsyncSession, factory
) -> None:
    for _ in range(3):
        await run_at_startup(GOOD, factory)

    assert len(await users(session)) == 1


async def test_with_no_variable_set_it_does_nothing_and_logs_nothing_about_an_admin(
    session: AsyncSession, factory, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.DEBUG)

    await run_at_startup({}, factory)

    assert await users(session) == []
    assert not any("admin" in message for message in messages(caplog))


async def test_with_only_some_variables_it_does_nothing_and_names_the_missing_ones_only(
    session: AsyncSession, factory, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.DEBUG)
    partial = {key: value for key, value in GOOD.items() if key != "BOOTSTRAP_ADMIN_PHONE"}

    await run_at_startup(partial, factory)

    assert await users(session) == []
    [message] = messages(caplog)
    assert "BOOTSTRAP_ADMIN_PHONE" in message
    assert "BOOTSTRAP_ADMIN_NAME" not in message  # only the missing ones are named
    assert_nothing_secret_in_the_log(caplog)


@pytest.mark.parametrize("blank", ["", "   "])
async def test_a_blank_variable_counts_as_not_set(
    session: AsyncSession, factory, caplog: pytest.LogCaptureFixture, blank: str
) -> None:
    caplog.set_level(logging.DEBUG)

    await run_at_startup({**GOOD, "BOOTSTRAP_ADMIN_NAME": blank}, factory)

    assert await users(session) == []
    assert any("BOOTSTRAP_ADMIN_NAME" in message for message in messages(caplog))


@pytest.mark.parametrize(
    ("variable", "value"),
    [
        ("BOOTSTRAP_ADMIN_PASSWORD", "short"),
        ("BOOTSTRAP_ADMIN_PHONE", "12345"),
        ("BOOTSTRAP_ADMIN_EMAIL", "not-an-email"),
    ],
)
async def test_a_bad_value_creates_nothing_never_raises_and_the_log_holds_no_value(
    session: AsyncSession, factory, caplog: pytest.LogCaptureFixture, variable: str, value: str
) -> None:
    caplog.set_level(logging.DEBUG)

    await run_at_startup({**GOOD, variable: value}, factory)  # must return normally

    assert await users(session) == []
    assert any(message.startswith("first admin not created") for message in messages(caplog))
    assert value not in caplog.text  # the sentence names the variable, never the value
    assert PASSWORD not in caplog.text


async def test_a_database_failure_never_raises_and_the_log_holds_neither_password_nor_address(
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.DEBUG)

    def broken_factory():
        raise ConnectionError(f"cannot connect with {PASSWORD} for {EMAIL}")

    await run_at_startup(GOOD, broken_factory)  # must return normally: the API still starts

    assert messages(caplog) == ["first admin step failed (ConnectionError). The API will start without it."]
    assert_nothing_secret_in_the_log(caplog)


# --- how the Dockerfile uses it ---


def start_command() -> str:
    return (Path(__file__).parents[2] / "Dockerfile").read_text()


def test_the_dockerfile_runs_it_between_the_migrations_and_the_api_and_a_failure_cannot_stop_it() -> None:
    text = start_command()

    migrate = text.index("alembic upgrade head")
    bootstrap = text.index("python -m app.bootstrap_admin --at-startup")
    api = text.index("uvicorn app.main:app")
    assert migrate < bootstrap < api
    step = text[bootstrap : text.index("&&", bootstrap)]
    assert "||" in step  # a failure is shrugged off, like the demo listings step


def test_no_password_or_admin_variable_value_is_written_in_the_dockerfile_or_the_blueprint() -> None:
    root = Path(__file__).parents[3]
    for path in [Path(__file__).parents[2] / "Dockerfile", root / "render.yaml"]:
        if path.exists():
            assert "BOOTSTRAP_ADMIN_PASSWORD" not in path.read_text(), path
