"""Queries on the services table that are not tied to one listing. Requirements: FR-05, US-05."""
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import Listing, Service
from app.models.base import ListingStatus


async def list_public_names(session: AsyncSession) -> list[str]:
    """The distinct service names of published listings, in one query. Drafts and hidden listings add none."""
    query = (
        select(Service.name)
        .join(Listing, col(Listing.id) == Service.listing_id)
        .where(Listing.status == ListingStatus.published)
        .distinct()
    )
    return list((await session.exec(query)).all())
