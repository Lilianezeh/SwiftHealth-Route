"""The lists behind the filters and forms. Requirements: FR-03, FR-05, US-05.

Decisions 1, 2 and 8 in specs/2026-10-09-meta-endpoint/requirements.md.
"""
from collections.abc import Iterable, Sequence

from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import BLOOD_GROUPS, settings
from app.core.service_catalogue import catalogue_for_meta
from app.core.service_names import normalise_service_name
from app.models.base import ReportReason
from app.repositories import category_repository, service_repository
from app.schemas.meta import MetaCategory, MetaResponse
from app.services import signup_service


def choose_service_names(names: Iterable[str], blood_groups: Sequence[str]) -> list[str]:
    """The service names a visitor can pick: trimmed, blood groups and blanks removed, one entry per name.

    Blood groups are stored as service rows, but they have their own list. Names that are the same service by
    `normalise_service_name` (capitals, end spaces and hyphens ignored: `Xray` and `X-ray`) count once, and
    the first spelling in plain string order is kept (`X-ray`, because "-" comes before "r"). The result is
    sorted without regard to case. Plain logic, so a plain `def`.
    """
    blood_group_keys = {group.strip().casefold() for group in blood_groups}
    spelling_by_service: dict[str, str] = {}
    for raw_name in names:
        name = " ".join(raw_name.split())  # the label shown: no spaces at the ends, one space between words
        service = normalise_service_name(name)  # the one rule, shared with the /search service filter
        if not service or name.casefold() in blood_group_keys:
            continue
        if service not in spelling_by_service or name < spelling_by_service[service]:
            spelling_by_service[service] = name
    return sorted(spelling_by_service.values(), key=lambda name: (name.casefold(), name))


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
        service_catalogue=catalogue_for_meta(),
        signup_open=signup_service.signup_is_open(),
        featured_price_naira=settings.featured_price,
    )
