"""Import every table so SQLModel.metadata (and Alembic) sees all 9."""
from app.models.audit_entry import AuditEntry
from app.models.category import Category
from app.models.listing import Listing
from app.models.opening_hours import OpeningHours
from app.models.phone_number import PhoneNumber
from app.models.service import Service
from app.models.user import User
from app.models.user_report import UserReport
from app.models.verification_check import VerificationCheck

__all__ = [
    "AuditEntry", "Category", "Listing", "OpeningHours", "PhoneNumber", "Service", "User",
    "UserReport", "VerificationCheck",
]
