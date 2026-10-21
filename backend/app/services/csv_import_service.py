"""Bulk import of listings from a CSV. Requirements: FR-39, FR-38, NFR-06, NFR-07.
Decision E2 in specs/2026-10-20-launch-readiness/requirements.md.

The rows become drafts owned by the admin, each with one primary phone and a `create` audit entry
(reference `csv-import`). A row with a problem is skipped and reported by its row number (the header
is row 1); the good rows are created in the same call. A row whose name and area already exist, in
the database or earlier in the file, is "Already listed", so the same file imported twice creates
nothing the second time. No HTTP here; no file is stored.
"""

import csv
import io
import math
from dataclasses import dataclass
from datetime import datetime

from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.core.phone import normalise_nigerian_phone
from app.models import Listing, PhoneNumber, User
from app.models.base import ListingStatus
from app.repositories import audit_repository, category_repository, listing_repository
from app.services.staff_listing_service import unique_slug

REQUIRED_COLUMNS = (
    "name",
    "category",
    "area",
    "address",
    "landmark",
    "latitude",
    "longitude",
    "phone",
    "is_24_hours",
)
MAX_ROWS = 500
MAX_BYTES = 1024 * 1024
IMPORT_REFERENCE = "csv-import"
TRUE_WORDS = {"true", "yes", "1"}
FALSE_WORDS = {"false", "no", "0", ""}


class CsvFileError(Exception):
    """The file as a whole cannot be read (missing columns, too many rows). The route answers 422."""


@dataclass(frozen=True)
class RowError:
    row: int
    detail: str


@dataclass(frozen=True)
class ImportResult:
    created: int
    errors: list[RowError]


def number_between(text: str, low: float, high: float) -> float | None:
    try:
        value = float(text.strip())
    except ValueError:
        return None
    return value if math.isfinite(value) and low <= value <= high else None


def read_rows(text: str) -> list[dict[str, str]]:
    """The data rows as dictionaries keyed by lower-case column name. Raises CsvFileError for the file."""
    reader = csv.DictReader(io.StringIO(text.lstrip("﻿")))
    names = [(name or "").strip().lower() for name in (reader.fieldnames or [])]
    missing = [column for column in REQUIRED_COLUMNS if column not in names]
    if missing:
        raise CsvFileError(f"The first row must name these columns: {', '.join(missing)}.")
    reader.fieldnames = names
    rows: list[dict[str, str]] = []
    for record in reader:
        if len(rows) >= MAX_ROWS:
            raise CsvFileError(
                f"A file can have at most {MAX_ROWS} rows. Split it and import the parts one by one."
            )
        rows.append({name: (value or "").strip() for name, value in record.items() if name is not None})
    return rows


async def import_listings(session: AsyncSession, admin: User, text: str, moment: datetime) -> ImportResult:
    """`moment` is passed in (never read from the clock here), so tests can choose the time."""
    rows = read_rows(text)
    categories = {category.slug: category for category in await category_repository.list_all(session)}
    known = await listing_repository.existing_name_area_pairs(session)
    errors: list[RowError] = []
    created = 0

    for index, row in enumerate(rows, start=2):
        problem = None
        phone = normalise_nigerian_phone(row["phone"])
        latitude = number_between(row["latitude"], -90, 90)
        longitude = number_between(row["longitude"], -180, 180)
        is_24 = row["is_24_hours"].lower()
        if not row["name"]:
            problem = "Name is required"
        elif row["category"] not in categories:
            problem = "Unknown category"
        elif row["area"] not in settings.areas:
            problem = "Unknown area"
        elif not row["address"]:
            problem = "Address is required"
        elif latitude is None:
            problem = "Latitude must be a number from -90 to 90"
        elif longitude is None:
            problem = "Longitude must be a number from -180 to 180"
        elif phone is None:
            problem = "Phone is not a Nigerian number"
        elif is_24 not in TRUE_WORDS | FALSE_WORDS:
            problem = "is_24_hours must be true or false"
        elif (row["name"].casefold(), row["area"].casefold()) in known:
            problem = "Already listed"
        if problem:
            errors.append(RowError(row=index, detail=problem))
            continue

        known.add((row["name"].casefold(), row["area"].casefold()))
        listing = Listing(
            slug=await unique_slug(session, row["name"], row["area"]),
            name=row["name"],
            category_id=categories[row["category"]].id,
            area=row["area"],
            address=row["address"],
            landmark=row["landmark"] or None,
            latitude=latitude,
            longitude=longitude,
            status=ListingStatus.draft,
            is_24_hours=is_24 in TRUE_WORDS,
            created_by=admin.id,
            created_at=moment,
            updated_at=moment,
        )
        await listing_repository.add_listing_with_details(
            session, listing, [PhoneNumber(listing_id=0, number=phone, is_primary=True)], [], []
        )
        await audit_repository.add_entry(
            session,
            user_id=admin.id,
            listing_id=listing.id,
            action="create",
            reference=IMPORT_REFERENCE,
            changed_at=moment,
        )
        created += 1

    await session.commit()
    return ImportResult(created=created, errors=errors)
