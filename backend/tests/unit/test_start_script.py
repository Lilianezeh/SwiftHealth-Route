"""The start-up script of the production container: no step can hang, and the API always starts.
Requirements: NFR-05, NFR-06. Spec: specs/2026-11-02-startup-never-hangs/.

Render started a deploy and then waited for an open port that never came: a step before the API (the
migrations, the demo listings, the first admin, the two-factor reset) was waiting, and "the previous deploy
stays live" while the new one timed out. None of those steps had a time limit. `backend/start.sh` now runs
each of them under `timeout` (then `kill`), with no input (stdin is /dev/null), and starts the API as its
last line whatever happened before.

These tests run the REAL script with fake `alembic`, `python` and `uvicorn` commands put first on the PATH. A
fake step can succeed, fail, wait for a long time, ignore the polite stop signal, or try to read input.
Nothing real is called and no database is used.
"""

import os
import re
import stat
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[2]
SCRIPT = BACKEND / "start.sh"
SECRET = "not-a-real-secret-value"


@dataclass(frozen=True)
class Step:
    label: str  # how the script names it in its messages
    command: str  # what it runs, as the fake command sees it
    marker: str  # a word only this step's arguments have


STEPS = {
    "migrations": Step("migrations", "alembic upgrade head", "head"),
    "demo listings": Step("demo listings", "python -m seed.demo_listings", "seed.demo_listings"),
    "first admin": Step("first admin", "python -m app.bootstrap_admin --at-startup", "app.bootstrap_admin"),
    "two-factor reset": Step(
        "two-factor reset", "python -m app.reset_two_factor --at-startup", "app.reset_two_factor"
    ),
}
API = "uvicorn app.main:app --host 0.0.0.0 --port"
# The steps that are logged by name and skipped when they fail or are stopped. The migrations are not one of
# them: if they fail or are stopped, the script stops with an error and the API is not started (the owner's
# rule of 2026-11-02), so the host keeps the previous deploy live, not new code on the old schema.
OPTIONAL = [name for name in STEPS if name != "migrations"]

# One fake command. It writes a line to $CALLS_LOG, then behaves as $FAKE_BEHAVIOUR says if its arguments
# hold $FAKE_STEP, and succeeds for every other step.
FAKE = """#!/bin/sh
echo "$(basename "$0") $*" >> "$CALLS_LOG"
if [ -n "$FAKE_STEP" ] && echo "$*" | grep -q -- "$FAKE_STEP"; then
  case "$FAKE_BEHAVIOUR" in
    fail) exit 3 ;;
    hang) exec sleep 60 ;;
    stubborn) trap '' TERM; sleep 60 ;;
    read) read -r line; echo "read-returned" >> "$CALLS_LOG" ;;
  esac
fi
exit 0
"""
FAKE_UVICORN = """#!/bin/sh
echo "uvicorn $* pid=$$" >> "$CALLS_LOG"
exit 0
"""


@pytest.fixture
def fakes(tmp_path: Path) -> Path:
    folder = tmp_path / "bin"
    folder.mkdir()
    for name, body in (("alembic", FAKE), ("python", FAKE), ("uvicorn", FAKE_UVICORN)):
        path = folder / name
        path.write_text(body)
        path.chmod(path.stat().st_mode | stat.S_IEXEC)
    return folder


@dataclass
class Run:
    code: int
    out: str
    calls: list[str]
    seconds: float

    @property
    def steps_and_api(self) -> list[str]:
        """What was called, in order, without the extra lines a fake writes."""
        return [line.split(" pid=")[0] for line in self.calls if not line.startswith("read-returned")]


def run_script(
    fakes: Path, tmp_path: Path, *, step: str = "", behaviour: str = "ok", env: dict[str, str] | None = None
) -> Run:
    calls, out = tmp_path / "calls.log", tmp_path / "out.log"
    calls.write_text("")
    environment = {
        **os.environ,
        "PATH": f"{fakes}:{os.environ['PATH']}",
        "CALLS_LOG": str(calls),
        "FAKE_STEP": step,
        "FAKE_BEHAVIOUR": behaviour,
        "STARTUP_STEP_TIMEOUT_SECONDS": "1",
        "MIGRATION_TIMEOUT_SECONDS": "1",
        "STARTUP_KILL_AFTER_SECONDS": "1",
        **(env or {}),
    }
    started = time.monotonic()
    with out.open("w") as output:
        # stdin is a pipe that stays open and never gets data: a step that waited for input would wait for
        # ever.
        process = subprocess.Popen(
            ["sh", str(SCRIPT)], env=environment, stdin=subprocess.PIPE, stdout=output, stderr=output
        )
        try:
            code = process.wait(timeout=40)
        finally:
            if process.stdin:
                process.stdin.close()
    return Run(code, out.read_text(), calls.read_text().splitlines(), time.monotonic() - started)


# ---------- the script's text ----------


def test_the_container_starts_through_the_script_and_not_through_a_chain_of_and_signs() -> None:
    commands = [line for line in (BACKEND / "Dockerfile").read_text().splitlines() if line.startswith("CMD")]

    assert commands == ['CMD ["sh", "/app/start.sh"]']


def test_every_step_goes_through_run_step_and_the_api_is_the_last_line_and_replaces_the_shell() -> None:
    text = SCRIPT.read_text()
    lines = [line.strip() for line in text.splitlines() if line.strip() and not line.strip().startswith("#")]

    steps = [
        line for line in lines if re.match(r'run_step "', line)
    ]  # the calls, not the definition `run_step() {`
    assert len(steps) == len(STEPS)
    for step in STEPS.values():
        assert any(step.command in line for line in steps), step.command
    migration_call = next(line for line in steps if STEPS["migrations"].command in line)
    assert migration_call.endswith("|| refuse_to_start")  # the migrations must succeed
    for name in OPTIONAL:
        call = next(line for line in steps if STEPS[name].command in line)
        assert call.endswith("|| skipped"), name  # the others are skipped when they fail
    assert lines[-1].startswith("exec uvicorn app.main:app --host 0.0.0.0 --port")
    assert '"${PORT:-8000}"' in lines[-1]
    outside = [line for line in lines if re.match(r"(alembic|python|uvicorn)\b", line)]
    assert outside == []  # no step is run by itself, outside run_step


def test_run_step_has_a_time_limit_a_kill_after_it_and_no_input() -> None:
    text = SCRIPT.read_text()
    body = text[text.index("run_step()") :]

    assert re.search(r"\btimeout -k\b", body)
    assert "</dev/null" in body
    assert not re.search(r"^\s*read\b", text, re.MULTILINE), "the script must never read input"


def test_the_script_is_posix_sh_and_it_stops_only_where_it_says_so() -> None:
    text = SCRIPT.read_text()

    assert text.startswith("#!/bin/sh")
    assert not re.search(r"^\s*set\s+-\w*e", text, re.MULTILINE)  # no step stops the script by accident
    assert (
        len(re.findall(r"^\s*exit\b", text, re.MULTILINE)) == 1
    )  # one place: refusing to start after the migrations
    body = text[text.index("refuse_to_start()") :]
    assert re.search(r"^\s*exit 1\b", body.split("}")[0], re.MULTILINE)  # a failure the host can see


def test_the_image_prints_each_line_at_once_so_a_stuck_step_shows_what_it_did() -> None:
    assert "PYTHONUNBUFFERED=1" in (BACKEND / "Dockerfile").read_text()


def test_the_migration_has_its_own_longer_limit_and_all_the_limits_together_stay_short() -> None:
    text = SCRIPT.read_text()

    migration = int(re.search(r"MIGRATION_TIMEOUT_SECONDS:-(\d+)", text).group(1))  # type: ignore[union-attr]
    other = int(re.search(r"STARTUP_STEP_TIMEOUT_SECONDS:-(\d+)", text).group(1))  # type: ignore[union-attr]
    kill_after = int(re.search(r"STARTUP_KILL_AFTER_SECONDS:-(\d+)", text).group(1))  # type: ignore[union-attr]
    assert migration > other  # a migration may take a while; a one-off admin step may not
    worst = (migration + kill_after) + 3 * (other + kill_after)
    assert worst <= 5 * 60  # the whole start-up, at its very worst, is under five minutes


# ---------- what it does ----------


def test_when_every_step_works_they_run_in_order_and_then_the_api_starts_on_the_port_of_the_host(
    fakes: Path, tmp_path: Path
) -> None:
    run = run_script(fakes, tmp_path, env={"PORT": "10000"})

    assert run.code == 0
    assert run.steps_and_api == [step.command for step in STEPS.values()] + [f"{API} 10000"]


def test_the_api_port_is_8000_when_the_host_names_none(fakes: Path, tmp_path: Path) -> None:
    run = run_script(fakes, tmp_path, env={"PORT": ""})  # empty counts as not set

    assert run.steps_and_api[-1] == f"{API} 8000"


@pytest.mark.parametrize("name", OPTIONAL)
def test_a_step_that_waits_for_a_long_time_is_stopped_and_the_api_still_starts(
    fakes: Path, tmp_path: Path, name: str
) -> None:
    run = run_script(fakes, tmp_path, step=STEPS[name].marker, behaviour="hang")

    assert run.steps_and_api[-1].startswith(API)
    assert len(run.steps_and_api) == 5  # the steps after the stuck one ran too
    assert run.seconds < 15  # about a second for the stuck step, not a minute
    assert f"{STEPS[name].label} stopped after 1s" in run.out.lower()
    assert "that step is skipped" in run.out.lower()  # said by name above, then skipped
    assert run.code == 0


@pytest.mark.parametrize("name", OPTIONAL)
def test_a_step_that_ignores_the_polite_stop_is_killed_and_the_api_still_starts(
    fakes: Path, tmp_path: Path, name: str
) -> None:
    run = run_script(fakes, tmp_path, step=STEPS[name].marker, behaviour="stubborn")

    assert run.steps_and_api[-1].startswith(API)
    assert run.seconds < 20
    assert f"{STEPS[name].label} stopped after 1s" in run.out.lower()


@pytest.mark.parametrize("name", OPTIONAL)
def test_a_step_that_fails_is_reported_and_the_api_still_starts(
    fakes: Path, tmp_path: Path, name: str
) -> None:
    run = run_script(fakes, tmp_path, step=STEPS[name].marker, behaviour="fail")

    assert run.steps_and_api[-1].startswith(API)
    assert len(run.steps_and_api) == 5
    assert f"{STEPS[name].label} failed (exit 3)" in run.out.lower()
    assert "that step is skipped" in run.out.lower()
    assert run.code == 0


@pytest.mark.parametrize("name", list(STEPS))
def test_a_step_that_asks_for_input_gets_none_and_does_not_wait(
    fakes: Path, tmp_path: Path, name: str
) -> None:
    run = run_script(fakes, tmp_path, step=STEPS[name].marker, behaviour="read")

    assert "read-returned" in run.calls  # the read ended at once: end of file, not a wait
    assert run.seconds < 10
    assert run.steps_and_api[-1].startswith(API)


def test_several_steps_stuck_at_once_still_end_with_the_api(fakes: Path, tmp_path: Path) -> None:
    run = run_script(
        fakes, tmp_path, step="--at-startup", behaviour="hang"
    )  # the first admin and the two-factor reset

    assert run.steps_and_api[-1].startswith(API)
    assert run.seconds < 20
    assert run.out.lower().count("stopped after") == 2


# ---------- the migrations must succeed (the owner's rule of 2026-11-02) ----------

NOT_STARTED = "the api is not started"
KEPT = "previous deploy stays live"


def test_a_migration_that_fails_stops_the_script_with_an_error_and_the_api_is_not_started(
    fakes: Path, tmp_path: Path
) -> None:
    run = run_script(fakes, tmp_path, step=STEPS["migrations"].marker, behaviour="fail")

    assert run.code == 1  # the host sees a failed start and keeps the previous deploy
    assert run.steps_and_api == ["alembic upgrade head"]  # nothing after it ran, and no API
    assert "migrations failed (exit 3)" in run.out.lower()
    assert NOT_STARTED in run.out.lower() and KEPT in run.out.lower()
    assert "skipped" not in run.out.lower()  # the migrations are never skipped


def test_a_migration_that_waits_for_a_long_time_is_stopped_with_an_error_and_the_api_is_not_started(
    fakes: Path, tmp_path: Path
) -> None:
    run = run_script(fakes, tmp_path, step=STEPS["migrations"].marker, behaviour="hang")

    assert run.code == 1
    assert run.steps_and_api == ["alembic upgrade head"]
    assert "migrations stopped after 1s" in run.out.lower()
    assert NOT_STARTED in run.out.lower() and KEPT in run.out.lower()
    assert run.seconds < 15  # one second, not a minute


def test_a_migration_that_ignores_the_polite_stop_is_killed_and_the_api_is_not_started(
    fakes: Path, tmp_path: Path
) -> None:
    run = run_script(fakes, tmp_path, step=STEPS["migrations"].marker, behaviour="stubborn")

    assert run.code == 1
    assert run.steps_and_api == ["alembic upgrade head"]
    assert "migrations stopped after 1s" in run.out.lower()
    assert run.seconds < 20


def test_when_the_migrations_work_every_other_step_can_fail_or_hang_and_the_api_still_starts(
    fakes: Path, tmp_path: Path
) -> None:
    run = run_script(
        fakes, tmp_path, step="--at-startup", behaviour="fail"
    )  # the first admin and the reset fail

    assert run.code == 0 and len(run.steps_and_api) == 5 and run.steps_and_api[-1].startswith(API)


def test_a_migration_error_message_holds_no_secret_of_the_environment(fakes: Path, tmp_path: Path) -> None:
    env = {
        "DATABASE_URL": f"postgresql://user:{SECRET}@host/db",
        "DATABASE_URL_DIRECT": f"postgresql://user:{SECRET}@direct/db",
    }

    run = run_script(fakes, tmp_path, step=STEPS["migrations"].marker, behaviour="fail", env=env)

    assert SECRET not in run.out and "postgresql://" not in run.out


def test_the_api_replaces_the_shell_so_the_host_signals_reach_it(fakes: Path, tmp_path: Path) -> None:
    calls = tmp_path / "calls.log"
    calls.write_text("")
    environment = {**os.environ, "PATH": f"{fakes}:{os.environ['PATH']}", "CALLS_LOG": str(calls)}
    process = subprocess.Popen(
        ["sh", str(SCRIPT)], env=environment, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )
    process.wait(timeout=40)

    api_line = next(line for line in calls.read_text().splitlines() if line.startswith("uvicorn"))
    assert api_line.endswith(f"pid={process.pid}")  # `exec`: the same process, now the API


def test_a_time_limit_of_the_environment_is_used(fakes: Path, tmp_path: Path) -> None:
    run = run_script(
        fakes, tmp_path, step="--at-startup", behaviour="hang", env={"STARTUP_STEP_TIMEOUT_SECONDS": "3"}
    )

    assert run.out.lower().count("stopped after 3s") == 2
    assert run.seconds >= 6  # two stuck steps of 3 seconds


def test_the_messages_never_hold_a_secret_that_is_in_the_environment(fakes: Path, tmp_path: Path) -> None:
    env = {
        "BOOTSTRAP_ADMIN_PASSWORD": SECRET,
        "BOOTSTRAP_ADMIN_EMAIL": f"{SECRET}@example.invalid",
        "DATABASE_URL": f"postgresql://user:{SECRET}@host/db",
        "CLOUDINARY_URL": f"cloudinary://key:{SECRET}@cloud",
    }

    run = run_script(fakes, tmp_path, step="--at-startup", behaviour="fail", env=env)

    assert SECRET not in run.out
    assert "postgresql://" not in run.out and "cloudinary://" not in run.out
