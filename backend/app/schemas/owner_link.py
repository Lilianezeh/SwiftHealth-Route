"""Shapes of the owner links. See specs/backend/api-spec.md section 7, "Phase 6a".
Requirements: FR-50, US-19."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

NOTE_MAX_LENGTH = 300


class CategoryRef(BaseModel):
    slug: str
    name: str


class OwnerListItem(BaseModel):
    """One of the caller's own links, whatever its state. Nothing about the facility's phone numbers."""

    link_id: int
    listing_id: int
    name: str
    area: str
    category: CategoryRef
    role: str  # owner or manager
    status: str  # pending, approved or removed
    requested_at: datetime


class OwnerList(BaseModel):
    items: list[OwnerListItem]


class QueuePerson(BaseModel):
    id: int
    name: str
    email: str
    phone: str | None


class QueuePhone(BaseModel):
    number: str
    label: str | None
    is_primary: bool


class QueueListing(BaseModel):
    id: int
    name: str
    area: str
    phones: list[QueuePhone]  # the numbers staff call to check the claim


class QueueItem(BaseModel):
    id: int
    role: str
    requested_at: datetime
    person: QueuePerson
    listing: QueueListing


class QueueList(BaseModel):
    items: list[QueueItem]
    total: int


class LinkRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    listing_id: int
    user_id: int
    role: str
    status: str
    requested_at: datetime
    approved_by: int | None
    approved_at: datetime | None
    removed_by: int | None
    removed_at: datetime | None
    note: str | None


class ApproveLink(BaseModel):
    """Approving needs the note: who staff reached on the phone."""

    note: str = Field(min_length=1, max_length=NOTE_MAX_LENGTH)

    @field_validator("note")
    @classmethod
    def not_blank(cls, note: str) -> str:
        stripped = note.strip()
        if not stripped:
            raise ValueError("note cannot be blank")
        return stripped


class DecisionNote(BaseModel):
    """Rejecting or removing may carry a note."""

    note: str | None = Field(default=None, max_length=NOTE_MAX_LENGTH)

    @field_validator("note")
    @classmethod
    def blank_is_no_note(cls, note: str | None) -> str | None:
        stripped = note.strip() if note is not None else None
        return stripped or None
