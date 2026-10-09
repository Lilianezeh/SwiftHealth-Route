"""The rules that shape the service list of GET /meta. Requirements: FR-05, US-05.

Pure logic (no database): decision 8 in specs/2026-10-09-meta-endpoint/requirements.md.
"""
import pytest

from app.core.config import BLOOD_GROUPS, settings
from app.models import Category
from app.schemas.meta import MetaResponse
from app.services import meta_service
from app.services.meta_service import choose_service_names

pytestmark = pytest.mark.anyio


def test_names_are_sorted_without_regard_to_case() -> None:
    assert choose_service_names(["X-ray", "blood test", "Consultation"], []) == [
        "blood test", "Consultation", "X-ray"
    ]


def test_a_name_listed_twice_counts_once() -> None:
    assert choose_service_names(["X-ray", "X-ray", "Consultation"], []) == ["Consultation", "X-ray"]


def test_names_that_differ_only_in_capitals_count_once_and_the_first_spelling_is_kept() -> None:
    assert choose_service_names(["x-ray", "X-ray", "X-RAY"], []) == ["X-RAY"]  # plain order: capitals first


def test_blood_groups_are_left_out() -> None:
    assert choose_service_names(["Blood bank", "A+", "O-", "AB+"], BLOOD_GROUPS) == ["Blood bank"]


def test_blood_groups_are_left_out_without_regard_to_case_and_spaces() -> None:
    assert choose_service_names(["a+", " O- ", "Consultation"], BLOOD_GROUPS) == ["Consultation"]


def test_a_name_that_only_looks_like_a_blood_group_stays() -> None:
    assert choose_service_names(["A+ screening", "Rh typing"], BLOOD_GROUPS) == ["A+ screening", "Rh typing"]


def test_blank_names_are_skipped_and_spaces_are_trimmed() -> None:
    assert choose_service_names(["", "   ", "  Consultation "], []) == ["Consultation"]


def test_no_names_gives_an_empty_list() -> None:
    assert choose_service_names([], BLOOD_GROUPS) == []


def test_the_input_is_not_changed() -> None:
    names = ["X-ray", "Consultation"]
    choose_service_names(names, [])
    assert names == ["X-ray", "Consultation"]


async def test_get_meta_builds_the_answer_from_the_repositories(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_categories(session: object) -> list[Category]:
        return [Category(id=1, name="Pharmacy", slug="pharmacy", is_emergency=False, recheck_days=45)]

    async def fake_service_names(session: object) -> list[str]:
        return ["x-ray", "X-ray", "O+", "Consultation"]

    monkeypatch.setattr(meta_service.category_repository, "list_all", fake_categories)
    monkeypatch.setattr(meta_service.service_repository, "list_public_names", fake_service_names)
    answer = await meta_service.get_meta(session=object())  # type: ignore[arg-type]
    assert isinstance(answer, MetaResponse)
    assert answer.areas == settings.areas
    assert [(category.slug, category.name, category.is_emergency) for category in answer.categories] == [
        ("pharmacy", "Pharmacy", False)
    ]
    assert answer.services == ["Consultation", "X-ray"]
    assert answer.blood_groups == BLOOD_GROUPS == ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
    assert answer.report_reasons == ["not_working", "wrong_number", "closed", "moved", "wrong_hours", "other"]
