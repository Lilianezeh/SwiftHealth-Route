"""Collects every route module into one router, so main.py only has to include this one."""
from fastapi import APIRouter

from app.api.routes import (
    account,
    admin,
    admin_accounts,
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
    signup,
    two_factor,
    uploads,
    verifications,
)

api_router = APIRouter()

all_route_modules = [
    public, auth, signup, two_factor, search, listings, emergency, blood, reports, verifications, providers,
    payments, uploads, dashboard, admin, admin_accounts, account,
]
for route_module in all_route_modules:
    api_router.include_router(route_module.router)
