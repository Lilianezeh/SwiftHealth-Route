"""Paystack initialise + signed webhook."""
from fastapi import APIRouter

router = APIRouter(prefix="/payments", tags=["payments"])

# TODO: add endpoints from specs/backend/api-spec.md
