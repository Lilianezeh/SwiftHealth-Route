"""The SQL version of the same-service rule must agree with the Python version. Requirements: FR-05, US-05.

Decision 9 in specs/2026-10-09-meta-endpoint/requirements.md. `/meta` merges names with the Python function
and `/search` matches them with the SQL expression; if they ever disagreed, the pick-from-list would silently
miss listings. The test asks PostgreSQL itself.
"""
import pytest
from sqlalchemy import String, literal
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.service_names import normalise_service_name, normalised_service_name_expression

pytestmark = pytest.mark.anyio

NAMES = [
    "", " ", "-", "--", " - ", "x", "X",
    "X-ray", "x-ray", " X-ray ", "Xray", "XRAY", "X-RAY", "x - ray", "x--ray", "-X-ray-",
    "Pap  Smear", "Pap\tSmear", "Pap \n Smear", "Pap\r\nSmear", "A\tB", "A\nB", "A \t\n B",
    "Malaria test", "Malaria-test", "  Malaria test  ", "Blood count", "Ultrasound",
    "CONSULTATION GÉNÉRALE", "Ñandú", "Dentiste-Orthodontiste", "A+", "O-", "AB-",
    "Prescription filling", "Antenatal care",
]


async def test_the_sql_expression_gives_the_same_result_as_the_python_function(session: AsyncSession) -> None:
    for name in NAMES:
        expression = normalised_service_name_expression(literal(name, String))
        from_database = (await session.exec(select(expression))).one()
        assert from_database == normalise_service_name(name), repr(name)


async def test_the_sql_expression_works_on_a_table_column(session: AsyncSession) -> None:
    from app.models import Service
    from tests.factories import add_listing

    await add_listing(session, "Scan Centre", service_names=(" X-ray ", "Xray", "Ultrasound"))
    await session.commit()
    names = (await session.exec(select(normalised_service_name_expression(Service.name)))).all()  # type: ignore[arg-type]
    assert sorted(names) == ["ultrasound", "xray", "xray"]
