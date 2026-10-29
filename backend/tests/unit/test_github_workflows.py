"""Tests for the scheduled GitHub Actions workflows: the nightly jobs and the Neon backup.

Requirements: NFR-09 (daily backup), FR-33 and FR-36 (the nightly re-check), NFR-05, NFR-06 (no
secret in the repository, none in a log). Spec: specs/2026-10-28-nightly-jobs/.

The repository is public, so the logs and the artifacts of a run can be read by anyone. These tests
hold the rules that keep that safe: a run starts only from the schedule or a button (never from a
pull request, where a stranger's code could read a secret), a secret is read only as
`secrets.NAME` and only the five named ones, nothing prints one, and only an encrypted file is
kept as an artifact, for 30 days (NFR-09).

The workflows are at the root of the repository. A test run inside the backend container does not
see them (only ./backend is mounted), so those tests are skipped there; they run in CI.
"""
import re
from pathlib import Path

import pytest
import yaml

WORKFLOW_FOLDER = Path(__file__).parents[3] / ".github" / "workflows"
NIGHTLY_JOBS = WORKFLOW_FOLDER / "nightly-jobs.yml"
NIGHTLY_BACKUP = WORKFLOW_FOLDER / "nightly-backup.yml"

pytestmark = pytest.mark.skipif(
    not NIGHTLY_JOBS.exists(), reason=".github/workflows is not mounted here"
)

# The only repository secrets these workflows may read. The owner adds exactly these five.
ALLOWED_SECRETS = {
    "DATABASE_URL_DIRECT",
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",
    "BACKUP_PASSPHRASE",
    "PAYSTACK_SECRET_KEY",  # a TEST key (sk_test_...), for the owner fee job's refunds
}


def load(path: Path) -> dict:
    return yaml.safe_load(path.read_text())


def triggers(workflow: dict) -> set[str]:
    # YAML 1.1 reads the key `on` as the boolean True.
    return set(trigger_block(workflow))


def trigger_block(workflow: dict) -> dict:
    return workflow.get("on", workflow.get(True))


def all_steps(workflow: dict) -> list[dict]:
    return [step for job in workflow["jobs"].values() for step in job["steps"]]


def run_text(workflow: dict) -> str:
    return "\n".join(step.get("run", "") for step in all_steps(workflow))


@pytest.fixture(params=[NIGHTLY_JOBS, NIGHTLY_BACKUP], ids=["nightly-jobs", "nightly-backup"])
def workflow_path(request) -> Path:
    return request.param


def test_runs_only_from_the_schedule_or_the_button(workflow_path):
    assert triggers(load(workflow_path)) == {"schedule", "workflow_dispatch"}


def test_the_token_can_only_read_the_repository(workflow_path):
    assert load(workflow_path)["permissions"] == {"contents": "read"}


def test_secrets_are_read_only_as_the_five_named_repository_secrets(workflow_path):
    used = set(re.findall(r"secrets\.([A-Za-z0-9_]+)", workflow_path.read_text()))
    assert used <= ALLOWED_SECRETS
    assert "secrets[" not in workflow_path.read_text()  # no secret picked by a computed name


def test_no_database_address_or_key_is_written_in_the_file(workflow_path):
    text = workflow_path.read_text()
    assert not re.search(r"postgres(ql)?(\+\w+)?://", text)
    assert "neon.tech" not in text
    assert not re.search(r"re_[A-Za-z0-9]{10,}", text)  # the shape of a Resend key


def test_nothing_prints_the_environment_or_traces_the_commands(workflow_path):
    for command in run_text(load(workflow_path)).splitlines():
        assert not re.search(r"set -\w*x|printenv|\benv\b\s*(\||$)|\bdeclare -p\b", command)
        if re.match(r"\s*echo\b", command):  # a message may name a secret, never read its value
            assert not re.search(r"\$\{?(DATABASE_URL|BACKUP_PASSPHRASE|RESEND_\w+)", command)

def test_actions_are_pinned_to_a_version(workflow_path):
    for step in all_steps(load(workflow_path)):
        if "uses" in step:
            assert re.fullmatch(r"[\w./-]+@v\d+(\.\d+){0,2}", step["uses"]), step["uses"]


def test_checkout_is_the_first_step_so_no_command_runs_before_the_repository_exists(workflow_path):
    # `defaults.run.working-directory: backend` does not exist until actions/checkout has run:
    # a `run` step before it fails with "No such file or directory" (seen on the first real run).
    for name, job in load(workflow_path)["jobs"].items():
        steps = job["steps"]
        checkout_positions = [
            position
            for position, step in enumerate(steps)
            if step.get("uses", "").startswith("actions/checkout@")
        ]
        assert checkout_positions, f"job {name} never checks out the repository"
        first_run_position = next(
            (position for position, step in enumerate(steps) if "run" in step), len(steps)
        )
        assert checkout_positions[0] < first_run_position, f"job {name} runs a command before checkout"


def test_every_job_has_a_time_limit(workflow_path):
    for job in load(workflow_path)["jobs"].values():
        assert job["timeout-minutes"] <= 15


def test_the_recheck_runs_at_01_00_lagos_time_which_is_00_00_utc():
    workflow = load(NIGHTLY_JOBS)
    assert trigger_block(workflow)["schedule"] == [{"cron": "0 0 * * *"}]
    assert "python -m app.jobs.recheck" in run_text(workflow)


def test_the_signup_clean_up_runs_in_the_same_nightly_workflow():
    assert "python -m app.jobs.purge_signups" in run_text(load(NIGHTLY_JOBS))


def test_the_jobs_reach_the_database_through_the_direct_address():
    for job in load(NIGHTLY_JOBS)["jobs"].values():
        assert job["env"]["DATABASE_URL"] == "${{ secrets.DATABASE_URL_DIRECT }}"


def test_only_the_recheck_and_the_owner_fee_get_the_email_secrets_and_only_the_fee_gets_paystack():
    jobs = load(NIGHTLY_JOBS)["jobs"]
    assert set(jobs["recheck"]["env"]) == {"DATABASE_URL", "RESEND_API_KEY", "RESEND_FROM_EMAIL"}
    assert set(jobs["purge-signups"]["env"]) == {"DATABASE_URL"}
    # The owner fee job emails reminders and asks Paystack (a TEST key) again for refunds it did not accept.
    assert set(jobs["owner-fee"]["env"]) == {
        "DATABASE_URL", "RESEND_API_KEY", "RESEND_FROM_EMAIL", "PAYSTACK_SECRET_KEY",
    }


def test_the_owner_fee_job_runs_in_the_nightly_workflow():
    assert "python -m app.jobs.owner_fee" in run_text(load(NIGHTLY_JOBS))


def test_the_backup_uses_the_script_with_the_address_read_from_the_environment():
    text = run_text(load(NIGHTLY_BACKUP))
    assert "scripts/backup-db.sh --url-from-env DATABASE_URL" in text


def test_the_dump_is_encrypted_and_the_plain_file_removed_before_the_upload():
    text = run_text(load(NIGHTLY_BACKUP))
    assert "gpg" in text and "--symmetric" in text and "AES256" in text
    assert "--passphrase-fd 0" in text  # the passphrase comes from stdin, not the command line
    assert text.index("--symmetric") < text.index("rm -f")


def test_only_encrypted_files_are_uploaded_and_for_30_days():
    uploads = [
        step
        for step in all_steps(load(NIGHTLY_BACKUP))
        if step.get("uses", "").startswith("actions/upload-artifact")
    ]
    assert len(uploads) == 1
    settings = uploads[0]["with"]
    assert settings["path"] == "backups/*.gpg"
    assert settings["retention-days"] == 30  # NFR-09: backups kept for 30 days
    assert settings["if-no-files-found"] == "error"


def test_the_passphrase_and_the_address_are_only_in_the_steps_that_need_them():
    job = next(iter(load(NIGHTLY_BACKUP)["jobs"].values()))
    assert "env" not in job  # a job-level variable would reach every step, even the upload
    steps_with_secrets = {
        step["name"]: set(step.get("env", {})) for step in job["steps"] if step.get("env")
    }
    for variables in steps_with_secrets.values():
        assert variables <= {"DATABASE_URL", "BACKUP_PASSPHRASE"}
    for step in job["steps"]:
        if step.get("uses", "").startswith("actions/upload-artifact"):
            assert not step.get("env")
