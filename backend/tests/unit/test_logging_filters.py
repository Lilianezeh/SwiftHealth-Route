"""No visitor position in the API access log. Requirement: NFR-07 (minimal personal data).

Decisions 5 to 7 in specs/2026-10-09-meta-endpoint/requirements.md. uvicorn writes the whole request line,
`GET /search?lat=6.45&lng=7.5 HTTP/1.1`, to `uvicorn.access`. The filter must turn the values of `lat`
and `lng` into `redacted` without losing the other parameters, and without ever stopping a log line.
"""
import asyncio
import logging
import socket

import httpx
import pytest
import uvicorn
from uvicorn.logging import AccessFormatter

from app.core.logging_filters import (
    REDACTED_VALUE,
    RedactLocationFilter,
    install_log_redaction,
    redact_location,
)

POSITION_WORDS = ("6.45", "7.5", "6.4512", "7.5033")


def access_record(path: str) -> logging.LogRecord:
    """A log record built the way uvicorn builds one (uvicorn/protocols/http/h11_impl.py)."""
    return logging.LogRecord(
        name="uvicorn.access", level=logging.INFO, pathname=__file__, lineno=1,
        msg='%s - "%s %s HTTP/%s" %d',
        args=("172.18.0.1:60230", "GET", path, "1.1", 200), exc_info=None,
    )


def test_lat_and_lng_values_are_replaced() -> None:
    assert redact_location("/search?lat=6.45&lng=7.5") == "/search?lat=redacted&lng=redacted"
    assert REDACTED_VALUE == "redacted"


def test_other_parameters_are_kept() -> None:
    path = "/search?q=Nigt%20Pharmcy&lat=6.45&category=pharmacy&lng=7.5&open_now=true&limit=5"
    expected = "/search?q=Nigt%20Pharmcy&lat=redacted&category=pharmacy&lng=redacted&open_now=true&limit=5"
    assert redact_location(path) == expected


@pytest.mark.parametrize(
    "path, expected",
    [
        ("/search?lat=6.45&lng=7.5&open_now=true", "/search?lat=redacted&lng=redacted&open_now=true"),
        (
            "/search?open_now=true&lat=6.45&lng=7.5&limit=3",
            "/search?open_now=true&lat=redacted&lng=redacted&limit=3",
        ),
        ("/search?open_now=true&lat=6.45&lng=7.5", "/search?open_now=true&lat=redacted&lng=redacted"),
        ("/search?lat=6.45", "/search?lat=redacted"),
        ("/search?lng=7.5", "/search?lng=redacted"),
    ],
)
def test_lat_and_lng_are_redacted_in_any_position(path: str, expected: str) -> None:
    assert redact_location(path) == expected


@pytest.mark.parametrize("path", ["/search?LAT=6.45&Lng=7.5", "/search?Lat=6.45&LNG=7.5"])
def test_the_names_are_matched_without_regard_to_case(path: str) -> None:
    redacted = redact_location(path)
    assert not any(word in redacted for word in POSITION_WORDS)
    assert redacted.count(REDACTED_VALUE) == 2


@pytest.mark.parametrize(
    "path",
    [
        "/search?%6Cat=6.45&l%6Eg=7.5",  # %6C is "l" and %6E is "n", so the names decode to "lat" and "lng"
        "/search?l%61t=6.45&ln%67=7.5",  # %61 is "a", %67 is "g"
        "/search?lat%3D6.45&lng%3D7.5",  # the "=" itself is encoded, so the whole thing is one name
        "/search?l%41t=6.45&LN%67=7.5",
    ],
)
def test_percent_encoded_names_are_redacted(path: str) -> None:
    redacted = redact_location(path)
    assert not any(word in redacted for word in POSITION_WORDS), redacted


def test_repeated_parameters_are_all_redacted() -> None:
    redacted = redact_location("/search?lat=6.45&lat=6.46&lng=7.5&lng=7.6")
    assert redacted == "/search?lat=redacted&lat=redacted&lng=redacted&lng=redacted"


@pytest.mark.parametrize(
    "path",
    ["/search?lat=&lng=", "/search?lat=abc&lng=xyz", "/search?lat=6.45%2C7.5", "/search?lat=-6.4&lng=-7.5"],
)
def test_empty_and_odd_values_are_redacted(path: str) -> None:
    redacted = redact_location(path)
    assert redacted.startswith("/search?lat=redacted")
    for leftover in ("abc", "xyz", "6.4", "%2C"):
        assert leftover not in redacted


@pytest.mark.parametrize(
    "path",
    [
        "/search?latitude=6.45&longitude=7.5",
        "/search?plat=1&flat=2&lng2=3&lat2=4&xlng=5",
        "/search?q=lat=1&category=lng=2",  # "lat=" inside a value is not a parameter named lat
        "/search?lat_long=6.45",
    ],
)
def test_similar_names_are_left_alone(path: str) -> None:
    assert redact_location(path) == path


@pytest.mark.parametrize(
    "path",
    ["/search", "/health", "/", "/listings/night-pharmacy-a", "/search?", "/search?open_now=true"],
)
def test_a_path_without_a_position_is_unchanged(path: str) -> None:
    assert redact_location(path) == path


def test_a_parameter_without_a_value_is_unchanged() -> None:
    assert redact_location("/search?lat&open_now=true") == "/search?lat&open_now=true"


def test_the_record_is_never_dropped() -> None:
    assert RedactLocationFilter().filter(access_record("/search?lat=6.45&lng=7.5")) is True
    assert RedactLocationFilter().filter(access_record("/health")) is True


def test_the_filter_rewrites_the_path_in_the_record() -> None:
    record = access_record("/search?lat=6.45&lng=7.5&open_now=true")
    RedactLocationFilter().filter(record)
    expected_path = "/search?lat=redacted&lng=redacted&open_now=true"
    assert record.args == ("172.18.0.1:60230", "GET", expected_path, "1.1", 200)


@pytest.mark.parametrize(
    "args",
    [
        (),  # no arguments
        ("only one",),
        ("client", "GET"),  # too few
        ("client", "GET", 12345, "1.1", 200),  # the path is not a string
        ("client", "GET", None, "1.1", 200),
        {"path": "/search?lat=6.45"},  # a mapping, as some loggers use
    ],
)
def test_a_record_it_does_not_understand_is_passed_on_unchanged(args: object) -> None:
    record = logging.LogRecord("uvicorn.access", logging.INFO, __file__, 1, "message %s", (), None)
    record.args = args  # type: ignore[assignment]
    before = record.args
    assert RedactLocationFilter().filter(record) is True
    assert record.args == before


def test_a_record_with_no_text_at_all_is_passed_on() -> None:
    record = logging.LogRecord("uvicorn.access", logging.INFO, __file__, 1, None, None, None)  # type: ignore[arg-type]
    assert RedactLocationFilter().filter(record) is True


def test_the_formatted_log_line_holds_no_position() -> None:
    # The full line as uvicorn prints it, with uvicorn's own formatter (a changed record shape fails here).
    record = access_record("/search?lat=6.4512&lng=7.5033&open_now=true")
    RedactLocationFilter().filter(record)
    line = AccessFormatter(use_colors=False).format(record)
    assert 'GET /search?lat=redacted&lng=redacted&open_now=true HTTP/1.1" 200' in line
    assert not any(word in line for word in POSITION_WORDS)


def test_the_filter_is_attached_to_uvicorn_access_after_the_app_is_imported() -> None:
    import app.main  # noqa: F401  (importing the app installs the filter)

    access_logger = logging.getLogger("uvicorn.access")
    assert any(isinstance(log_filter, RedactLocationFilter) for log_filter in access_logger.filters)


def test_installing_twice_attaches_the_filter_once() -> None:
    install_log_redaction()
    install_log_redaction()
    access_logger = logging.getLogger("uvicorn.access")
    assert sum(isinstance(log_filter, RedactLocationFilter) for log_filter in access_logger.filters) == 1


class ListHandler(logging.Handler):
    def __init__(self) -> None:
        super().__init__()
        self.lines: list[str] = []

    def emit(self, record: logging.LogRecord) -> None:
        self.lines.append(AccessFormatter(use_colors=False).format(record))


@pytest.mark.anyio
async def test_a_real_uvicorn_request_writes_no_position_to_the_access_log() -> None:
    # The real thing: start uvicorn, send a request with a position, read what it logged.
    import app.main  # noqa: F401  (makes sure the filter is installed)

    with socket.socket() as free_socket:
        free_socket.bind(("127.0.0.1", 0))
        port = free_socket.getsockname()[1]
    handler = ListHandler()
    access_logger = logging.getLogger("uvicorn.access")
    access_logger.addHandler(handler)
    previous_level = access_logger.level
    access_logger.setLevel(logging.INFO)
    # log_config=None: uvicorn does not reset our logger set-up for this in-process test.
    server = uvicorn.Server(uvicorn.Config("app.main:app", host="127.0.0.1", port=port, log_config=None))
    server_task = asyncio.create_task(server.serve())
    try:
        for _ in range(100):
            if server.started:
                break
            await asyncio.sleep(0.05)
        assert server.started, "uvicorn did not start"
        async with httpx.AsyncClient() as client:
            url = f"http://127.0.0.1:{port}/health?lat=6.4512&lng=7.5033&open_now=true"
            response = await client.get(url)
        assert response.status_code == 200
    finally:
        server.should_exit = True
        await server_task
        access_logger.removeHandler(handler)
        access_logger.setLevel(previous_level)
    assert handler.lines, "uvicorn wrote no access line"
    line = handler.lines[-1]
    assert "/health?lat=redacted&lng=redacted&open_now=true" in line
    assert not any(word in line for word in POSITION_WORDS)
