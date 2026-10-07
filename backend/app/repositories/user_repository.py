from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import User
from app.models.base import Role


async def get_by_email(session: AsyncSession, email: str) -> User | None:
    return (await session.exec(select(User).where(User.email == email))).first()


async def create(
    session: AsyncSession, *, name: str, email: str, phone: str | None, password_hash: str, role: Role
) -> User:
    """Adds the user and flushes so it has an id. The caller commits."""
    user = User(name=name, email=email, phone=phone, password_hash=password_hash, role=role)
    session.add(user)
    await session.flush()
    return user
