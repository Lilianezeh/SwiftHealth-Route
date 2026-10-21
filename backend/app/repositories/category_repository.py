from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import Category


async def get_by_slug(session: AsyncSession, slug: str) -> Category | None:
    return (await session.exec(select(Category).where(Category.slug == slug))).first()


async def list_all(session: AsyncSession) -> list[Category]:
    """Every category, in the order they were created (by id)."""
    return list((await session.exec(select(Category).order_by(col(Category.id)))).all())


async def create(
    session: AsyncSession, *, name: str, slug: str, is_emergency: bool, recheck_days: int
) -> Category:
    """Adds the category and flushes so it has an id. The caller commits."""
    category = Category(name=name, slug=slug, is_emergency=is_emergency, recheck_days=recheck_days)
    session.add(category)
    await session.flush()
    return category


async def get_by_id(session: AsyncSession, category_id: int) -> Category | None:
    return await session.get(Category, category_id)
