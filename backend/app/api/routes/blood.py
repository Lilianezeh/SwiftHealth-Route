"""Find blood (blood banks) and donate blood (donation centres). See specs/backend/api-spec.md section 3."""
from fastapi import APIRouter

router = APIRouter(prefix="/blood", tags=["blood"])

# TODO: GET /blood/banks and GET /blood/donation-centres
