from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings

# create_async_engine: the async create_engine (SQLAlchemy asyncio docs); queries never block the event loop.
engine = create_async_engine(settings.database_url, pool_pre_ping=True)

# async_sessionmaker with expire_on_commit=False: objects keep their values after commit, because reading
# an expired attribute needs an implicit query, and async code cannot run one (SQLAlchemy asyncio docs).
session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    # AsyncSession (SQLModel): one session per request; its `exec` and `commit` must be awaited.
    async with session_factory() as session:
        yield session
