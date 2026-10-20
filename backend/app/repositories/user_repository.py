from datetime import datetime

from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import User
from app.models.base import Role


async def get_by_email(session: AsyncSession, email: str) -> User | None:
    return (await session.exec(select(User).where(User.email == email))).first()


async def get_by_id(session: AsyncSession, user_id: int) -> User | None:
    return await session.get(User, user_id)


async def set_last_login(session: AsyncSession, user: User, logged_in_at: datetime) -> None:
    """Records the login time and flushes. The caller commits."""
    user.last_login_at = logged_in_at
    session.add(user)
    await session.flush()


async def create(
    session: AsyncSession, *, name: str, email: str, phone: str | None, password_hash: str, role: Role
) -> User:
    """Adds the user and flushes so it has an id. The caller commits."""
    user = User(name=name, email=email, phone=phone, password_hash=password_hash, role=role)
    session.add(user)
    await session.flush()
    return user


async def list_active_with_roles(session: AsyncSession, roles: set[Role]) -> list[User]:
    """The active users with one of the roles, oldest first. Tells staff of a flagged listing (FR-22)."""
    query = (
        select(User)
        .where(col(User.is_active).is_(True), col(User.role).in_(roles))
        .order_by(col(User.id))
    )
    return list((await session.exec(query)).all())
