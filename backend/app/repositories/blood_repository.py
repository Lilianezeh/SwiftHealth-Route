"""The only code that queries the database for the blood lists.
Requirements: US-15, US-16, FR-27, FR-28, FR-08, FR-22. Decisions F1 and F4 in specs/2026-10-20-blood/.

It finds the published, unflagged listings that match a rule about their category and services, and
returns each with its category, primary phone, hours and services. Distance, order and paging are
business rules and happen in blood_service.
"""

from collections.abc import Collection
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import ColumnElement, and_, exists, or_
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.service_names import normalised_service_name_expression
from app.models import Category, Listing, Service
from app.models.base import ListingStatus
from app.repositories.search_repository import SearchCandidate, candidates_from_rows, flagged_listing_ids


@dataclass(frozen=True)
class ListingWithServices:
    candidate: SearchCandidate
    services: list[Service]


def has_service_in(service_keys: Collection[str]) -> ColumnElement[bool]:
    """The listing has a service whose name, by the same-service rule, is one of `service_keys`."""
    return exists().where(
        Service.listing_id == Listing.id,
        normalised_service_name_expression(col(Service.name)).in_(list(service_keys)),
    )


async def find_listings(
    session: AsyncSession,
    *,
    category_slug: str | None,
    any_service_keys: Collection[str],
    required_service_keys: Collection[str] | None,
    reports_since: datetime,
    reports_to_exclude: int,
) -> list[ListingWithServices]:
    """Published, unflagged listings in `category_slug` OR with a service in `any_service_keys`, and
    (when given) also with a service in `required_service_keys`. With no category, services decide."""
    reasons: list[ColumnElement[bool]] = []
    if category_slug is not None:
        reasons.append(Category.slug == category_slug)
    if any_service_keys:
        reasons.append(has_service_in(any_service_keys))
    conditions: list[ColumnElement[bool]] = [
        Listing.status == ListingStatus.published,
        col(Listing.id).not_in(flagged_listing_ids(reports_since, reports_to_exclude)),
        or_(*reasons),
    ]
    if required_service_keys is not None:
        conditions.append(has_service_in(required_service_keys))
    rows = (
        await session.exec(
            select(Listing, Category)
            .join(Category, col(Category.id) == Listing.category_id)
            .where(and_(*conditions))
        )
    ).all()
    candidates = await candidates_from_rows(session, rows)
    services_by_listing: dict[int, list[Service]] = {}
    listing_ids = [candidate.listing.id for candidate in candidates]
    if listing_ids:
        for service in await session.exec(
            select(Service).where(col(Service.listing_id).in_(listing_ids)).order_by(col(Service.id))
        ):
            services_by_listing.setdefault(service.listing_id, []).append(service)
    return [
        ListingWithServices(candidate, services_by_listing.get(candidate.listing.id, []))
        for candidate in candidates
    ]
