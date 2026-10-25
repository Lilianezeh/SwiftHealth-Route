"""What the API says at start-up about the authenticator-app key. Requirements: FR-58, NFR-06.
Spec: specs/2026-10-23-accounts-and-facility-ownership/ (found when production said "not available yet").

`secret_box.describe_key()` tells, in one fixed sentence, whether `TOTP_ENCRYPTION_KEY` can be used and, if not, why: not set,
the public development key, or not a key of the right form. The sentence never holds the key, nor any part of it; for a key of
the wrong form it says how many characters the value has (a good key has 44), which is how a lost "=" or a cut paste is seen.
"""

import base64
import logging

import pytest
from cryptography.fernet import Fernet
from fastapi import FastAPI

from app.core import secret_box
from app.core.config import settings
from app.main import app, lifespan

pytestmark = pytest.mark.anyio

GOOD = Fernet.generate_key().decode()  # 44 characters, ends with "="


def set_key(monkeypatch: pytest.MonkeyPatch, key: str, environment: str = "production") -> None:
    monkeypatch.setattr(settings, "app_env", environment)
    monkeypatch.setattr(settings, "totp_encryption_key", key)


def test_a_good_key_is_usable(monkeypatch: pytest.MonkeyPatch) -> None:
    set_key(monkeypatch, GOOD)

    report = secret_box.describe_key()

    assert report.usable is True
    assert report.status == "ok"
    assert report.sentence == "Authenticator app: TOTP_ENCRYPTION_KEY is set and usable."


def test_no_key_says_it_is_not_set(monkeypatch: pytest.MonkeyPatch) -> None:
    set_key(monkeypatch, "")

    report = secret_box.describe_key()

    assert (report.usable, report.status) == (False, "missing")
    assert "is not set" in report.sentence and "not available" in report.sentence


def test_a_blank_key_counts_as_not_set(monkeypatch: pytest.MonkeyPatch) -> None:
    set_key(monkeypatch, "   ")

    assert secret_box.describe_key().status == "missing"


def test_in_development_with_no_key_the_public_key_is_used_and_it_says_so(monkeypatch: pytest.MonkeyPatch) -> None:
    set_key(monkeypatch, "", "development")

    report = secret_box.describe_key()

    assert (report.usable, report.status) == (True, "development")
    assert "development" in report.sentence


def test_the_public_development_key_is_refused_outside_development_and_says_so(monkeypatch: pytest.MonkeyPatch) -> None:
    set_key(monkeypatch, secret_box.DEVELOPMENT_KEY)

    report = secret_box.describe_key()

    assert (report.usable, report.status) == (False, "development_key_refused")
    assert "public development key" in report.sentence
    assert secret_box.DEVELOPMENT_KEY not in report.sentence


@pytest.mark.parametrize(
    ("key", "length"),
    [
        (GOOD.rstrip("="), 43),  # the "=" was lost: "Incorrect padding"
        (GOOD[:30], 30),  # a paste cut short
        (base64.urlsafe_b64encode(b"x" * 24).decode(), 32),  # a key of 24 bytes, not 32
        (bytes(range(32)).hex(), 64),  # hex, not base64
        ("not a key at all!", 17),
    ],
)
def test_a_key_of_the_wrong_form_says_how_long_the_value_is_and_never_shows_it(
    monkeypatch: pytest.MonkeyPatch, key: str, length: int
) -> None:
    set_key(monkeypatch, key)

    report = secret_box.describe_key()

    assert (report.usable, report.status) == (False, "invalid")
    assert f"{length} characters" in report.sentence
    assert "44 characters" in report.sentence and "ends with =" in report.sentence
    assert key not in report.sentence
    assert key[:8] not in report.sentence


def test_the_report_agrees_with_what_the_secret_box_does(monkeypatch: pytest.MonkeyPatch) -> None:
    for key, environment in [(GOOD, "production"), ("", "production"), ("", "development"), (GOOD[:30], "production")]:
        set_key(monkeypatch, key, environment)
        assert secret_box.describe_key().usable == secret_box.is_available()


# --- at start-up ---


def start_up_lines(caplog: pytest.LogCaptureFixture) -> list[tuple[int, str]]:
    return [(record.levelno, record.getMessage()) for record in caplog.records if record.name == "uvicorn.error"]


async def test_the_start_up_logs_one_info_line_when_the_key_is_good_and_never_the_key(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    set_key(monkeypatch, GOOD)

    with caplog.at_level(logging.INFO, logger="uvicorn.error"):
        async with lifespan(FastAPI()):
            pass

    assert start_up_lines(caplog) == [(logging.INFO, "Authenticator app: TOTP_ENCRYPTION_KEY is set and usable.")]
    assert GOOD not in caplog.text


@pytest.mark.parametrize("key", ["", GOOD.rstrip("="), secret_box.DEVELOPMENT_KEY])
async def test_the_start_up_logs_a_warning_when_the_key_cannot_be_used_and_the_api_still_starts(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture, key: str
) -> None:
    set_key(monkeypatch, key)
    started = False

    with caplog.at_level(logging.INFO, logger="uvicorn.error"):
        async with lifespan(FastAPI()):
            started = True  # the body of the lifespan runs: the API is up

    assert started
    [(level, message)] = start_up_lines(caplog)
    assert level == logging.WARNING
    assert message.startswith("Authenticator app: TOTP_ENCRYPTION_KEY")
    assert "not available" in message
    if key:
        assert key not in caplog.text and key[:8] not in caplog.text


async def test_the_app_has_the_lifespan() -> None:
    assert app.router.lifespan_context is not None
    async with app.router.lifespan_context(app):
        pass
