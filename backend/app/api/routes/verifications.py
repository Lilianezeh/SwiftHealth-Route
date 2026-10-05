"""Verifier call and visit logs: /listings/{listing_id}/checks. See specs/backend/api-spec.md section 5."""
from fastapi import APIRouter

router = APIRouter(prefix="/listings", tags=["verifications"])

# TODO: POST and GET /listings/{listing_id}/checks
