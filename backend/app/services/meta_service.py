"""The lists behind the filters and forms. Requirements: FR-03, FR-05, US-05.

Decisions 1, 2 and 8 in specs/2026-10-09-meta-endpoint/requirements.md.
"""
from collections.abc import Iterable, Sequence

from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import BLOOD_GROUPS, settings
from app.models.base import ReportReason
from app.repositories import category_repository, service_repository
from app.schemas.meta import MetaCategory, MetaResponse


def choose_service_names(names: Iterable[str], blood_groups: Sequence[str]) -> list[str]:
    """The service names a visitor can pick: trimmed, blood groups and blanks removed, one entry per name.

    Blood groups are stored as service rows, but they have their own list. Names that differ only in capitals
    count once, and the first spelling in plain string order is kept (capitals come first). The result is
    sorted without regard to case. Plain logic, so a plain `def`.
    """
    blood_group_keys = {group.casefold() for group in blood_groups}
    spelling_by_key: dict[str, str] = {}
    for raw_name in names:
        name = raw_name.strip()
        key = name.casefold()
        if not name or key in blood_group_keys:
            continue
        if key not in spelling_by_key or name < spelling_by_key[key]:
            spelling_by_key[key] = name
    return sorted(spelling_by_key.values(), key=lambda name: (name.casefold(), name))


async def get_meta(session: AsyncSession) -> MetaResponse:
    categories = await category_repository.list_all(session)
    service_names = await service_repository.list_public_names(session)
    return MetaResponse(
        areas=list(settings.areas),
        categories=[
            MetaCategory(slug=category.slug, name=category.name, is_emergency=category.is_emergency)
            for category in categories
        ],
        services=choose_service_names(service_names, BLOOD_GROUPS),
        blood_groups=list(BLOOD_GROUPS),
        report_reasons=[reason.value for reason in ReportReason],
    )
