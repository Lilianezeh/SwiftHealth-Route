"""require_role and require_listing_access through HTTP. Requirements: FR-30, NFR-06 (role-based access).

Both dependencies are tried on a throwaway app that exists only in this file, because no real staff route uses
them yet. The throwaway app shares the test session, so the database state is the same as in the other tests.
"""
import pytest
from fastapi import Depends, FastAPI
from httpx import ASGITransport, AsyncClient

from app.api.dependencies import get_session, require_listing_access, require_role
from app.core.security import create_access_token, create_challenge_token
from app.models import Listing, User
from app.models.base import ListingStatus, Role
from app.repositories import category_repository, listing_repository
from tests.factories import add_owner_link

pytestmark = pytest.mark.anyio

access_app = FastAPI()


@access_app.get("/editors")
def editors_only(user: User = Depends(require_role(Role.editor))) -> dict:
    return {"role": user.role.value}


@access_app.get("/staff")
def any_staff(user: User = Depends(require_role(Role.verifier, Role.editor, Role.admin))) -> dict:
    return {"role": user.role.value}


@access_app.get("/providers")
def providers_only(user: User = Depends(require_role(Role.provider))) -> dict:
    return {"role": user.role.value}


@access_app.get("/listings/{listing_id}/edit")
def edit_listing(listing: Listing = Depends(require_listing_access)) -> dict:
    return {"id": listing.id}


@pytest.fixture
async def access_client(session):
    async def get_test_session():
        yield session

    access_app.dependency_overrides[get_session] = get_test_session
    async with AsyncClient(transport=ASGITransport(app=access_app), base_url="http://test") as test_client:
        yield test_client
    access_app.dependency_overrides.clear()


def bearer_for(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id, user.role)}"}


async def add_listing(session, status=ListingStatus.published, created_by=None, owner_id=None) -> Listing:
    category = await category_repository.get_by_slug(session, "hospital")
    if category is None:
        category = await category_repository.create(
            session, name="Hospital", slug="hospital", is_emergency=True, recheck_days=14
        )
    listing = Listing(
        slug=f"demo-{status.value}-{created_by}-{owner_id}", name="Demo Hospital", category_id=category.id,
        area="GRA", address="1 Demo Street", latitude=6.45, longitude=7.5, status=status,
        created_by=created_by, owner_id=owner_id,
    )
    await listing_repository.add_listing_with_details(session, listing, [], [], [])
    await session.commit()
    return listing


# --- require_role ---

async def test_a_listed_role_is_allowed(access_client, demo_users):
    response = await access_client.get("/editors", headers=bearer_for(demo_users[Role.editor]))
    assert response.status_code == 200
    assert response.json() == {"role": "editor"}


@pytest.mark.parametrize("path", ["/editors", "/staff"])
async def test_admin_passes_a_check_that_lists_a_staff_role(access_client, demo_users, path):
    response = await access_client.get(path, headers=bearer_for(demo_users[Role.admin]))
    assert response.status_code == 200


@pytest.mark.parametrize("role", [Role.verifier, Role.provider])
async def test_a_role_that_is_not_listed_gets_403(access_client, demo_users, role):
    response = await access_client.get("/editors", headers=bearer_for(demo_users[role]))
    assert response.status_code == 403


async def test_admin_does_not_pass_a_provider_only_check(access_client, demo_users):
    response = await access_client.get("/providers", headers=bearer_for(demo_users[Role.admin]))
    assert response.status_code == 403
    provider_response = await access_client.get("/providers", headers=bearer_for(demo_users[Role.provider]))
    assert provider_response.status_code == 200


async def test_a_staff_check_rejects_a_provider(access_client, demo_users):
    response = await access_client.get("/staff", headers=bearer_for(demo_users[Role.provider]))
    assert response.status_code == 403


@pytest.mark.parametrize("path", ["/editors", "/staff", "/providers", "/listings/1/edit"])
async def test_no_token_gets_401(access_client, demo_users, path):
    assert (await access_client.get(path)).status_code == 401


async def test_a_bad_token_gets_401(access_client, demo_users):
    challenge_token = create_challenge_token(demo_users[Role.admin].id, "123456")  # not an access token
    for bad_token in ("garbage", challenge_token):
        response = await access_client.get("/staff", headers={"Authorization": f"Bearer {bad_token}"})
        assert response.status_code == 401


async def test_an_inactive_user_gets_403(access_client, demo_users, session):
    editor = demo_users[Role.editor]
    headers = bearer_for(editor)
    editor.is_active = False
    await session.commit()
    assert (await access_client.get("/staff", headers=headers)).status_code == 403


async def test_the_role_is_read_from_the_database_not_the_token(access_client, demo_users, session):
    user = demo_users[Role.editor]
    headers = bearer_for(user)
    assert (await access_client.get("/staff", headers=headers)).status_code == 200
    user.role = Role.provider  # demoted after the token was issued
    await session.commit()
    assert (await access_client.get("/staff", headers=headers)).status_code == 403


# --- require_listing_access ---

async def test_a_missing_listing_gets_404(access_client, demo_users):
    response = await access_client.get("/listings/9999/edit", headers=bearer_for(demo_users[Role.editor]))
    assert response.status_code == 404


async def test_editor_can_open_any_listing(access_client, demo_users, session):
    listing = await add_listing(session, ListingStatus.published, created_by=demo_users[Role.verifier].id)
    editor_headers = bearer_for(demo_users[Role.editor])
    response = await access_client.get(f"/listings/{listing.id}/edit", headers=editor_headers)
    assert response.status_code == 200
    assert response.json() == {"id": listing.id}


async def test_verifier_can_open_their_own_draft_but_not_other_listings(access_client, demo_users, session):
    verifier, editor = demo_users[Role.verifier], demo_users[Role.editor]
    own_draft = await add_listing(session, ListingStatus.draft, created_by=verifier.id)
    other_draft = await add_listing(session, ListingStatus.draft, created_by=editor.id)
    own_published = await add_listing(session, ListingStatus.published, created_by=verifier.id)
    headers = bearer_for(verifier)
    assert (await access_client.get(f"/listings/{own_draft.id}/edit", headers=headers)).status_code == 200
    assert (await access_client.get(f"/listings/{other_draft.id}/edit", headers=headers)).status_code == 403
    assert (await access_client.get(f"/listings/{own_published.id}/edit", headers=headers)).status_code == 403


async def test_provider_can_open_only_their_own_listing(access_client, demo_users, session):
    provider = demo_users[Role.provider]
    own_listing = await add_listing(session, owner_id=provider.id)
    await add_owner_link(session, own_listing, provider)  # since phase 6a an approved link gives the access
    other_listing = await add_listing(session, owner_id=demo_users[Role.editor].id)
    await session.commit()
    headers = bearer_for(provider)
    assert (await access_client.get(f"/listings/{own_listing.id}/edit", headers=headers)).status_code == 200
    assert (await access_client.get(f"/listings/{other_listing.id}/edit", headers=headers)).status_code == 403
