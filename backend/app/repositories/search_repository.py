"""The only code that queries the database for search. Requirements: US-01, US-05, FR-04, FR-05, FR-08, FR-22.

It returns every published listing that passes the SQL filters, with its category, primary phone and hours.
Distance, open now, sorting and paging are business rules and happen in search_service.
"""
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import ColumnElement, and_, exists, func, or_
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import Category, Listing, OpeningHours, PhoneNumber, Service, UserReport
from app.models.base import ListingStatus, ReportReason, ReportStatus


@dataclass(frozen=True)
class SearchCandidate:
    listing: Listing
    category: Category
    primary_phone: str | None
    opening_hours: list[OpeningHours]


def flagged_listing_ids(reports_since: datetime, reports_to_exclude: int):  # noqa: ANN201 (a SQL subquery)
    """Listings that enough different reporters call "not working" (FR-22). Open reports with a key only."""
    return (
        select(UserReport.listing_id)
        .where(
            UserReport.reason == ReportReason.not_working,
            UserReport.status == ReportStatus.open,
            UserReport.created_at >= reports_since,
            col(UserReport.reporter_key).is_not(None),
        )
        .group_by(UserReport.listing_id)
        .having(func.count(func.distinct(UserReport.reporter_key)) >= reports_to_exclude)
    )


def text_matches(text: str, column: ColumnElement, match_threshold: float) -> ColumnElement[bool]:
    """Trigram match (pg_trgm) that tolerates misspellings: `text` must resemble a run of words in the column.

    The column is also tried without hyphens: "xray" finds "X-ray" and "trans ekulu" finds "Trans-Ekulu".
    """
    return or_(
        func.word_similarity(text, column) >= match_threshold,
        func.word_similarity(text, func.replace(column, "-", "")) >= match_threshold,
    )


def listing_matches(text: str, match_threshold: float) -> ColumnElement[bool]:
    """`text` resembles the listing's name, its area, or the name of one of its services."""
    service_matches = exists().where(
        Service.listing_id == Listing.id, text_matches(text, col(Service.name), match_threshold)
    )
    return or_(
        text_matches(text, col(Listing.name), match_threshold),
        text_matches(text, col(Listing.area), match_threshold),
        service_matches,
    )


def query_matches(
    search_text: str, search_words: Sequence[str], match_threshold: float
) -> ColumnElement[bool]:
    """The whole query matches, or (for 2 or more words) every word matches somewhere in the listing.

    The word rule only adds matches: "Nigt Pharmcy" scores 0.50 as a whole but each word scores 0.55 or more.
    A word may match the name, the area or a service, so "pharmcy ogui" finds a pharmacy in Ogui.
    """
    whole_query = listing_matches(search_text, match_threshold)
    if not search_words:
        return whole_query
    every_word = and_(*(listing_matches(word, match_threshold) for word in search_words))
    return or_(whole_query, every_word)


async def find_candidates(
    session: AsyncSession,
    *,
    search_text: str | None,
    search_words: Sequence[str],
    category_slug: str | None,
    service_name: str | None,
    area: str | None,
    is_24_hours: bool,
    reports_since: datetime,
    reports_to_exclude: int,
    match_threshold: float,
) -> list[SearchCandidate]:
    conditions: list[ColumnElement[bool]] = [
        Listing.status == ListingStatus.published,
        col(Listing.id).not_in(flagged_listing_ids(reports_since, reports_to_exclude)),
    ]
    if category_slug is not None:
        conditions.append(Category.slug == category_slug)
    if area is not None:
        conditions.append(Listing.area == area)
    if is_24_hours:
        conditions.append(col(Listing.is_24_hours).is_(True))
    if service_name is not None:
        conditions.append(
            exists().where(Service.listing_id == Listing.id, func.lower(Service.name) == service_name.lower())
        )
    if search_text is not None:
        conditions.append(query_matches(search_text, search_words, match_threshold))

    query = (
        select(Listing, Category)
        .join(Category, col(Category.id) == Listing.category_id)
        .where(and_(*conditions))
    )
    rows = (await session.exec(query)).all()
    listing_ids = [listing.id for listing, _ in rows]
    primary_phones = await _primary_phones(session, listing_ids)
    hours_by_listing = await _opening_hours(session, listing_ids)
    return [
        SearchCandidate(
            listing=listing,
            category=category,
            primary_phone=primary_phones.get(listing.id),
            opening_hours=hours_by_listing.get(listing.id, []),
        )
        for listing, category in rows
    ]


async def _primary_phones(session: AsyncSession, listing_ids: list[int]) -> dict[int, str]:
    query = select(PhoneNumber).where(
        col(PhoneNumber.listing_id).in_(listing_ids), col(PhoneNumber.is_primary).is_(True)
    )
    phones = await session.exec(query)
    return {phone.listing_id: phone.number for phone in phones}


async def _opening_hours(session: AsyncSession, listing_ids: list[int]) -> dict[int, list[OpeningHours]]:
    hours_by_listing: dict[int, list[OpeningHours]] = {}
    for row in await session.exec(select(OpeningHours).where(col(OpeningHours.listing_id).in_(listing_ids))):
        hours_by_listing.setdefault(row.listing_id, []).append(row)
    return hours_by_listing
