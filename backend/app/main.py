"""Creates the FastAPI app: settings, CORS and all routes."""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.rate_limit import get_client_ip

app = FastAPI(title="SwiftHealth API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health", tags=["health"])
def health() -> dict:
    return {"status": "ok"}


# TEMPORARY (phase 4, Task 3): shows the caller their own forwarding headers so we can count the proxies in front of
# the API on Render. Removed in the next commit, before the pull request is ready. NFR-06, NFR-07.
@app.get("/proxy-probe", include_in_schema=False)
def proxy_probe(request: Request) -> dict:
    forwarding_prefixes = ("x-forwarded", "cf-", "true-client", "forwarded", "x-real")
    forwarding_headers = {
        name: value for name, value in request.headers.items() if name.startswith(forwarding_prefixes)
    }
    return {
        "forwarding_headers": forwarding_headers,
        "socket_client": request.client.host if request.client else None,
        "trusted_proxy_count": settings.trusted_proxy_count,
        "client_ip_we_use": get_client_ip(request, settings.trusted_proxy_count),
    }
