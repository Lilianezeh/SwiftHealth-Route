"""Public search: the hard part (distance + open now in WAT + trust filter)."""
from fastapi import APIRouter

router = APIRouter(prefix="/search", tags=["search"])

# TODO: add endpoints from specs/backend/api-spec.md
