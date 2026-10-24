"""How long until a limited key may call again. Requirements: FR-57, NFR-06 (the cost limit on login codes).
Spec: specs/2026-10-23-accounts-and-facility-ownership/ (Phase 2b).
"""

from datetime import timedelta

from app.core.rate_limit import RateLimiter
from tests.unit.test_rate_limit import FakeClock

ONE_HOUR = timedelta(hours=1)


def make_limiter(clock: FakeClock) -> RateLimiter:
    return RateLimiter(max_calls=5, window=ONE_HOUR, clock=clock)


def test_a_key_under_the_limit_waits_for_nothing() -> None:
    limiter = make_limiter(FakeClock())
    for _ in range(4):
        limiter.allow("user:1")

    assert limiter.retry_after_seconds("user:1") == 0
    assert limiter.retry_after_seconds("never-seen") == 0


def test_a_key_at_the_limit_waits_until_its_oldest_call_leaves_the_hour() -> None:
    clock = FakeClock()
    limiter = make_limiter(clock)
    for _ in range(5):
        limiter.allow("user:1")
        clock.move_forward(timedelta(minutes=10))  # calls at 0, 10, 20, 30, 40 minutes; now 50 minutes

    assert limiter.allow("user:1") is False
    assert limiter.retry_after_seconds("user:1") == 10 * 60  # the first call (minute 0) leaves at minute 60


def test_the_wait_shrinks_and_is_over_when_the_oldest_call_has_left() -> None:
    clock = FakeClock()
    limiter = make_limiter(clock)
    for _ in range(5):
        limiter.allow("user:1")
    clock.move_forward(timedelta(minutes=59, seconds=30))

    assert limiter.retry_after_seconds("user:1") == 30

    clock.move_forward(timedelta(seconds=30))
    assert limiter.retry_after_seconds("user:1") == 0
    assert limiter.allow("user:1") is True


def test_the_wait_is_rounded_up_to_whole_seconds() -> None:
    clock = FakeClock()
    limiter = make_limiter(clock)
    for _ in range(5):
        limiter.allow("user:1")
    clock.now_seconds += 3599.2

    assert limiter.retry_after_seconds("user:1") == 1


def test_asking_does_not_count_as_a_call_and_one_key_does_not_limit_another() -> None:
    limiter = make_limiter(FakeClock())
    for _ in range(5):
        limiter.allow("user:1")

    for _ in range(20):
        limiter.retry_after_seconds("user:1")

    assert limiter.allow("user:2") is True
    assert limiter.retry_after_seconds("user:1") > 0
