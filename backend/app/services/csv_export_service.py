"""CSV export of listings and verification checks. Requirements: FR-40, NFR-06, NFR-07.
Decision E3 in specs/2026-10-20-launch-readiness/requirements.md.

Every text cell goes through `neutralise_cell`, so a spreadsheet never runs a name such as
`=HYPERLINK(...)` as a formula. The files hold no password hash, no reporter phone and no reporter
key: those columns are simply not in them.
"""

import csv
import io
from collections.abc import Iterable
from datetime import datetime
from enum import Enum

from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.csv_cells import neutralise_cell
from app.repositories import listing_repository, verification_repository

LISTING_COLUMNS = (
    "id",
    "slug",
    "name",
    "category",
    "area",
    "address",
    "landmark",
    "latitude",
    "longitude",
    "phone",
    "is_24_hours",
    "status",
    "last_verified_at",
    "next_check_due",
)
CHECK_COLUMNS = (
    "id",
    "listing_id",
    "listing_name",
    "staff_name",
    "method",
    "result",
    "person_reached",
    "notes",
    "photo_url",
    "checked_at",
)


class ExportType(str, Enum):
    listings = "listings"
    checks = "checks"


def when(moment: datetime | None) -> str | None:
    return moment.isoformat() if moment else None


def to_csv(columns: Iterable[str], rows: Iterable[Iterable[object]]) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(columns)
    for row in rows:
        writer.writerow([neutralise_cell(cell) for cell in row])
    return buffer.getvalue()


async def export_csv(session: AsyncSession, kind: ExportType) -> str:
    if kind == ExportType.listings:
        listings = await listing_repository.list_all_with_primary_phone(session)
        return to_csv(
            LISTING_COLUMNS,
            (
                (
                    listing.id,
                    listing.slug,
                    listing.name,
                    category.slug,
                    listing.area,
                    listing.address,
                    listing.landmark,
                    listing.latitude,
                    listing.longitude,
                    phone,
                    listing.is_24_hours,
                    listing.status.value,
                    when(listing.last_verified_at),
                    when(listing.next_check_due),
                )
                for listing, category, phone in listings
            ),
        )
    checks = await verification_repository.list_all_for_export(session)
    return to_csv(
        CHECK_COLUMNS,
        (
            (
                check.id,
                check.listing_id,
                listing_name,
                staff_name,
                check.method.value,
                check.result.value,
                check.person_reached,
                check.notes,
                check.photo_url,
                when(check.checked_at),
            )
            for check, listing_name, staff_name in checks
        ),
    )
