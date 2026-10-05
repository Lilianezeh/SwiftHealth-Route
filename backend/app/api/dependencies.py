"""Shared FastAPI dependencies used by routes (session, current user, role checks).

TODO: get_current_user (reads the Bearer token) and require_role(...) for role checks.
"""
from app.core.database import get_session

__all__ = ["get_session"]
