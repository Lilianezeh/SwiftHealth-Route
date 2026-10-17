"""Creates the FastAPI app: settings, CORS and all routes."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import NETLIFY_PREVIEW_ORIGIN_REGEX, settings
from app.core.logging_filters import install_log_redaction

install_log_redaction()  # the API access log must never keep a visitor's lat and lng (NFR-07)

app = FastAPI(title="SwiftHealth API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=NETLIFY_PREVIEW_ORIGIN_REGEX,  # Starlette matches the whole origin against it
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health", tags=["Health"])
def health() -> dict:
    return {"status": "ok"}
