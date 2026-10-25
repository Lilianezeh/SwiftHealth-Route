"""Creates the FastAPI app: settings, CORS and all routes."""
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core import secret_box
from app.core.config import NETLIFY_PREVIEW_ORIGIN_REGEX, settings
from app.core.logging_filters import install_log_redaction

install_log_redaction()  # the API access log must never keep a visitor's lat and lng (NFR-07)

# uvicorn's own logger, so the line shows in the Render log at INFO (our own modules' loggers show warnings only).
startup_logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Runs once when the API starts (FastAPI docs: Lifespan Events). It says, in one fixed sentence, whether
    the authenticator-app key can be used and why not: the key, or any part of it, is never written (FR-58)."""
    report = secret_box.describe_key()
    startup_logger.log(logging.INFO if report.usable else logging.WARNING, report.sentence)
    yield


app = FastAPI(title="SwiftHealth API", version="0.1.0", lifespan=lifespan)

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
