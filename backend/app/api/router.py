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
    emergency_admin,
    listing_changes,
    listings,
    owner_requests,
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
    public, auth, signup, two_factor, search, listings, listing_changes, emergency, blood, reports,
    verifications, providers,
    payments, uploads, dashboard, admin, admin_accounts, account, owner_requests,
    emergency_admin,
]
for route_module in all_route_modules:
    api_router.include_router(route_module.router)
