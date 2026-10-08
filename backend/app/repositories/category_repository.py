from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import Category


async def get_by_slug(session: AsyncSession, slug: str) -> Category | None:
    return (await session.exec(select(Category).where(Category.slug == slug))).first()


async def create(
    session: AsyncSession, *, name: str, slug: str, is_emergency: bool, recheck_days: int
) -> Category:
    """Adds the category and flushes so it has an id. The caller commits."""
    category = Category(name=name, slug=slug, is_emergency=is_emergency, recheck_days=recheck_days)
    session.add(category)
    await session.flush()
    return category
