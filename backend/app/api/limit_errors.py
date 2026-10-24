"""The 429 answers of the login-code limits, shared by the login and two-factor routes. FR-57, FR-58.

Each is an HTTPException with a plain sentence for the person and the standard `Retry-After` header in
whole seconds, so the screen can count. HTTP work, so it lives here and not in a service.
"""
import math

from fastapi import HTTPException, status


def _plural(count: int, word: str) -> str:
    return f"{count} {word}" if count == 1 else f"{count} {word}s"


def _too_many(message: str, seconds_left: int) -> HTTPException:
    return HTTPException(
        status.HTTP_429_TOO_MANY_REQUESTS, message, headers={"Retry-After": str(seconds_left)}
    )


def code_too_soon(seconds_left: int) -> HTTPException:
    """A new code asked for within 60 seconds of the last one."""
    return _too_many(f"Wait {_plural(seconds_left, 'second')} before asking for a new code.", seconds_left)


def too_many_codes(seconds_left: int) -> HTTPException:
    """The sixth code in an hour for one account."""
    minutes = math.ceil(seconds_left / 60)
    return _too_many(f"Too many codes. Try again in {_plural(minutes, 'minute')}.", seconds_left)


def too_many_wrong_codes(seconds_left: int) -> HTTPException:
    """Ten wrong codes from the app (or backup codes) in an hour for one account."""
    minutes = math.ceil(seconds_left / 60)
    return _too_many(f"Too many wrong codes. Try again in {_plural(minutes, 'minute')}.", seconds_left)
