"""Keep the visitor's position out of the API access log. Requirement: NFR-07 (minimal personal data).

uvicorn writes the whole request line to the `uvicorn.access` logger, for example
`GET /search?lat=6.4512&lng=7.5033&open_now=true HTTP/1.1`. A position is personal data, so the filter
below turns the values of `lat` and `lng` into `redacted` and keeps everything else, because status codes,
timing and the other filters are what we need to debug.
Decision 5 in specs/2026-10-09-meta-endpoint/requirements.md.
"""
import logging
from urllib.parse import unquote_plus

REDACTED_PARAMETERS = {"lat", "lng"}
REDACTED_VALUE = "redacted"
ACCESS_LOGGER_NAME = "uvicorn.access"
PATH_ARGUMENT_INDEX = 2  # uvicorn logs (client address, method, path, HTTP version, status code)


def redact_location(request_path: str) -> str:
    """Replaces the value of every `lat` and `lng` parameter in a request path with `redacted`.

    The match is on the parameter name only, without regard to case and also when the name is percent-encoded.
    Names that only look similar (`latitude`, `plat`) and the text inside other values are left alone.
    """
    path, question_mark, query = request_path.partition("?")
    if not question_mark:
        return request_path
    parts = []
    for part in query.split("&"):
        name, equals_sign, _value = part.partition("=")
        # An encoded "=" (lat%3D6.45) puts the value inside the decoded name: cut the name at the first "=".
        decoded_name, decoded_equals_sign, _decoded_value = unquote_plus(name).partition("=")
        has_value = bool(equals_sign or decoded_equals_sign)
        if decoded_name.strip().lower() in REDACTED_PARAMETERS and has_value:
            shown_name = name if equals_sign else decoded_name.strip()  # an encoded "=" is shown decoded
            parts.append(f"{shown_name}={REDACTED_VALUE}")
        else:
            parts.append(part)
    return f"{path}?{'&'.join(parts)}"


class RedactLocationFilter(logging.Filter):
    """Rewrites the request path of an access log record. It never drops a record and never raises."""

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            arguments = record.args
            if (
                isinstance(arguments, tuple)
                and len(arguments) > PATH_ARGUMENT_INDEX
                and isinstance(arguments[PATH_ARGUMENT_INDEX], str)
            ):
                before = arguments[:PATH_ARGUMENT_INDEX]
                after = arguments[PATH_ARGUMENT_INDEX + 1:]
                record.args = (*before, redact_location(arguments[PATH_ARGUMENT_INDEX]), *after)
        except Exception:  # noqa: BLE001 (a broken filter must never stop the API from logging or answering)
            return True
        return True


def install_log_redaction() -> None:
    """Attaches the filter to the access logger once. Safe to call again."""
    access_logger = logging.getLogger(ACCESS_LOGGER_NAME)
    if not any(isinstance(log_filter, RedactLocationFilter) for log_filter in access_logger.filters):
        access_logger.addFilter(RedactLocationFilter())
