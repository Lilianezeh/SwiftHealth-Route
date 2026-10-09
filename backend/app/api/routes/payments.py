"""Paystack initialise + signed webhook."""
from fastapi import APIRouter

router = APIRouter(prefix="/payments", tags=["Payments"])

# TODO: add endpoints from specs/backend/api-spec.md
