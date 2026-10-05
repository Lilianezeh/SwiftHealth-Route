from sqlmodel import Session, select

from app.models import User
from app.models.base import Role


def get_by_email(session: Session, email: str) -> User | None:
    return session.exec(select(User).where(User.email == email)).first()


def create(
    session: Session, *, name: str, email: str, phone: str | None, password_hash: str, role: Role
) -> User:
    """Adds the user and flushes so it has an id. The caller commits."""
    user = User(name=name, email=email, phone=phone, password_hash=password_hash, role=role)
    session.add(user)
    session.flush()
    return user
