"""POST /uploads/sign. Requirements: FR-32, US-10, NFR-06. Decision C8 in specs/2026-10-20-staff-screens/.
The clock is replaced with a fixed moment so the timestamp is known. Keys are fictional; no Cloudinary call.
"""

from collections.abc import Iterator
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient

from app.api.dependencies import get_current_moment
from app.core.config import settings
from app.integrations.cloudinary import sign_parameters
from app.main import app
from app.models import User
from app.models.base import Role
from tests.staff_helpers import bearer_for

pytestmark = pytest.mark.anyio

NOW = datetime(2026, 10, 6, 9, 0, tzinfo=timezone.utc)
SECRET = "secret-not-real"


@pytest.fixture
def clock() -> Iterator[None]:
    app.dependency_overrides[get_current_moment] = lambda: NOW
    yield
    app.dependency_overrides.pop(get_current_moment, None)


@pytest.fixture
def cloudinary_account(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "cloudinary_url", f"cloudinary://123456789012345:{SECRET}@demo-cloud")
    monkeypatch.setattr(settings, "cloudinary_upload_preset", "")


async def sign(client: AsyncClient, user: User | None, folder: object = "entrances"):
    headers = bearer_for(user) if user else {}
    return await client.post("/uploads/sign", json={"folder": folder}, headers=headers)


async def test_signing_needs_a_login_and_a_staff_role(
    client: AsyncClient, demo_users: dict[Role, User], clock: None, cloudinary_account: None
) -> None:
    assert (await sign(client, None)).status_code == 401
    assert (await sign(client, demo_users[Role.provider])).status_code == 403


@pytest.mark.parametrize("role", [Role.verifier, Role.editor, Role.admin])
async def test_staff_get_the_parameters_for_a_direct_upload(
    client: AsyncClient, demo_users: dict[Role, User], clock: None, cloudinary_account: None, role: Role
) -> None:
    response = await sign(client, demo_users[role])
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["cloud_name"] == "demo-cloud"
    assert body["api_key"] == "123456789012345"
    assert body["timestamp"] == int(NOW.timestamp())
    assert body["folder"] == "swifthealth/entrances"
    assert body["signature"] == sign_parameters(
        {"folder": "swifthealth/entrances", "timestamp": str(int(NOW.timestamp()))}, SECRET
    )
    assert "upload_preset" not in body or body["upload_preset"] is None


async def test_the_secret_is_never_in_the_answer(
    client: AsyncClient, demo_users: dict[Role, User], clock: None, cloudinary_account: None
) -> None:
    response = await sign(client, demo_users[Role.verifier])
    assert SECRET not in response.text
    assert "api_secret" not in response.text


async def test_an_upload_preset_is_signed_and_returned_only_when_one_is_set(
    client: AsyncClient,
    demo_users: dict[Role, User],
    clock: None,
    cloudinary_account: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "cloudinary_upload_preset", "swifthealth_entrances")
    body = (await sign(client, demo_users[Role.verifier])).json()
    assert body["upload_preset"] == "swifthealth_entrances"
    assert body["signature"] == sign_parameters(
        {
            "folder": "swifthealth/entrances",
            "timestamp": str(int(NOW.timestamp())),
            "upload_preset": "swifthealth_entrances",
        },
        SECRET,
    )


@pytest.mark.parametrize("folder", ["", "avatars", "../entrances", "swifthealth/entrances", 5, None])
async def test_only_the_entrances_folder_is_allowed(
    client: AsyncClient, demo_users: dict[Role, User], clock: None, cloudinary_account: None, folder: object
) -> None:
    assert (await sign(client, demo_users[Role.verifier], folder)).status_code == 422


async def test_without_a_cloudinary_account_the_answer_is_503_and_says_so(
    client: AsyncClient, demo_users: dict[Role, User], clock: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "cloudinary_url", "")
    response = await sign(client, demo_users[Role.verifier])
    assert response.status_code == 503
    assert response.json() == {"detail": "Photo upload is not set up."}


async def test_a_broken_account_setting_is_also_503_and_leaks_nothing(
    client: AsyncClient, demo_users: dict[Role, User], clock: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "cloudinary_url", "cloudinary://key-123:secret-456@")
    response = await sign(client, demo_users[Role.verifier])
    assert response.status_code == 503
    assert "secret-456" not in response.text and "key-123" not in response.text


# --- the owner's own folder (owner form, part (b), decision L3) ---


async def sign_for_owner(client: AsyncClient, user: User | None):
    headers = bearer_for(user) if user else {}
    return await client.post("/uploads/owner-sign", headers=headers)


async def test_a_facility_owner_gets_parameters_for_the_owner_folder_only(
    client: AsyncClient, demo_users: dict[Role, User], clock: None, cloudinary_account: None
) -> None:
    response = await sign_for_owner(client, demo_users[Role.provider])

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["folder"] == "swifthealth/owner-entrances"
    assert body["cloud_name"] == "demo-cloud"
    assert body["signature"] == sign_parameters(
        {"folder": "swifthealth/owner-entrances", "timestamp": str(int(NOW.timestamp()))}, SECRET
    )
    assert SECRET not in response.text and "api_secret" not in response.text


async def test_the_owner_folder_is_for_owners_only_and_the_staff_folder_for_staff_only(
    client: AsyncClient, demo_users: dict[Role, User], clock: None, cloudinary_account: None
) -> None:
    assert (await sign_for_owner(client, None)).status_code == 401
    for role in (Role.verifier, Role.editor, Role.admin):
        assert (await sign_for_owner(client, demo_users[role])).status_code == 403
    assert (await sign(client, demo_users[Role.provider])).status_code == 403  # the staff folder


async def test_the_owner_signature_is_signed_with_the_upload_preset_when_one_is_set(
    client: AsyncClient,
    demo_users: dict[Role, User],
    clock: None,
    cloudinary_account: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "cloudinary_upload_preset", "swifthealth_entrances")

    body = (await sign_for_owner(client, demo_users[Role.provider])).json()

    assert body["upload_preset"] == "swifthealth_entrances"
    assert body["signature"] == sign_parameters(
        {
            "folder": "swifthealth/owner-entrances",
            "timestamp": str(int(NOW.timestamp())),
            "upload_preset": "swifthealth_entrances",
        },
        SECRET,
    )


async def test_signing_for_an_owner_is_limited_to_20_a_day_for_each_address(
    client: AsyncClient, demo_users: dict[Role, User], clock: None, cloudinary_account: None
) -> None:
    provider = demo_users[Role.provider]
    for _ in range(20):
        assert (await sign_for_owner(client, provider)).status_code == 200

    assert (await sign_for_owner(client, provider)).status_code == 429


async def test_without_a_cloudinary_account_the_owner_answer_is_503(
    client: AsyncClient, demo_users: dict[Role, User], clock: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "cloudinary_url", "")

    response = await sign_for_owner(client, demo_users[Role.provider])

    assert response.status_code == 503
    assert response.json() == {"detail": "Photo upload is not set up."}
