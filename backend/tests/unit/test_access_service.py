"""The role by ownership matrix for editing a listing. Requirements: FR-30, NFR-06 (role-based access).

Decision 7 in specs/2026-10-05-auth-and-roles/requirements.md. Editor and admin: any listing. Verifier: only a
draft they created. Provider: only the listing they own. Plain objects are enough: no database is involved.
"""
import pytest

from app.models import Listing, User
from app.models.base import ListingStatus, Role
from app.services.access_service import NotAllowedError, ensure_can_edit_listing

USER_ID = 7
OTHER_USER_ID = 8


def make_user(role: Role) -> User:
    return User(id=USER_ID, name="Demo", email="demo@demo.example.com", password_hash="x", role=role)


def make_listing(
    status: ListingStatus = ListingStatus.published,
    created_by: int | None = None,
    owner_id: int | None = None,
) -> Listing:
    return Listing(
        slug="demo", name="Demo", category_id=1, area="GRA", address="1 Demo Street", latitude=6.45,
        longitude=7.5, status=status, created_by=created_by, owner_id=owner_id,
    )


def is_allowed(role: Role, listing: Listing) -> bool:
    try:
        ensure_can_edit_listing(make_user(role), listing)
    except NotAllowedError:
        return False
    return True


@pytest.mark.parametrize("role", [Role.editor, Role.admin])
@pytest.mark.parametrize("status", list(ListingStatus))
@pytest.mark.parametrize("created_by", [None, USER_ID, OTHER_USER_ID])
def test_editor_and_admin_can_edit_any_listing(role, status, created_by):
    assert is_allowed(role, make_listing(status=status, created_by=created_by, owner_id=OTHER_USER_ID))


def test_verifier_can_edit_their_own_draft():
    assert is_allowed(Role.verifier, make_listing(ListingStatus.draft, created_by=USER_ID))


def test_verifier_cannot_edit_another_verifiers_draft():
    assert not is_allowed(Role.verifier, make_listing(ListingStatus.draft, created_by=OTHER_USER_ID))


def test_verifier_cannot_edit_a_draft_nobody_created():
    assert not is_allowed(Role.verifier, make_listing(ListingStatus.draft, created_by=None))


@pytest.mark.parametrize("status", [status for status in ListingStatus if status != ListingStatus.draft])
def test_verifier_cannot_edit_their_own_listing_once_it_is_not_a_draft(status):
    assert not is_allowed(Role.verifier, make_listing(status, created_by=USER_ID))


def test_verifier_owning_a_listing_does_not_help():
    # Ownership is a provider rule: a verifier is limited to drafts they created.
    assert not is_allowed(Role.verifier, make_listing(ListingStatus.published, owner_id=USER_ID))


@pytest.mark.parametrize("status", list(ListingStatus))
def test_provider_is_not_allowed_by_the_role_only_check_even_as_the_old_owner(status):
    # Since accounts phase 6a a provider's access comes from an approved link in the database, which the async
    # `ensure_can_edit` looks up (tests/integration/test_owner_links.py); `owner_id` is no longer read.
    assert not is_allowed(Role.provider, make_listing(status, owner_id=USER_ID))


def test_provider_cannot_edit_someone_elses_listing():
    assert not is_allowed(Role.provider, make_listing(owner_id=OTHER_USER_ID))


def test_provider_cannot_edit_a_listing_with_no_owner():
    assert not is_allowed(Role.provider, make_listing(owner_id=None))


def test_provider_who_created_a_draft_but_does_not_own_it_cannot_edit_it():
    assert not is_allowed(Role.provider, make_listing(ListingStatus.draft, created_by=USER_ID, owner_id=None))
