from sqlmodel import Session, select

from app.models import Category


def get_by_slug(session: Session, slug: str) -> Category | None:
    return session.exec(select(Category).where(Category.slug == slug)).first()


def create(session: Session, *, name: str, slug: str, is_emergency: bool, recheck_days: int) -> Category:
    """Adds the category and flushes so it has an id. The caller commits."""
    category = Category(name=name, slug=slug, is_emergency=is_emergency, recheck_days=recheck_days)
    session.add(category)
    session.flush()
    return category
