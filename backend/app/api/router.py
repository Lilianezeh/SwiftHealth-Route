"""Collects every route module into one router, so main.py only has to include this one."""
from fastapi import APIRouter

from app.api.routes import (
    admin,
    auth,
    blood,
    dashboard,
    emergency,
    listings,
    payments,
    providers,
    public,
    reports,
    search,
    uploads,
    verifications,
)

api_router = APIRouter()

all_route_modules = [
    public, auth, search, listings, emergency, blood, reports, verifications, providers, payments, uploads,
    dashboard, admin,
]
for route_module in all_route_modules:
    api_router.include_router(route_module.router)
