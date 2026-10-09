"""GET /meta through HTTP. Requirements: FR-03 (area list), FR-05 and US-05 (category and service filters).

The contract is specs/backend/api-spec.md, "GET /meta". Decisions 1, 2, 3 and 8 in
specs/2026-10-09-meta-endpoint/requirements.md.
"""
import pytest
from httpx import AsyncClient
from sqlalchemy import event
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.core.service_names import normalise_service_name
from app.main import app
from app.models.base import ListingStatus
from app.repositories import category_repository
from app.services import meta_service
from tests.factories import add_listing

pytestmark = pytest.mark.anyio

REPORT_REASONS_IN_THE_API_SPEC = ["not_working", "wrong_number", "closed", "moved", "wrong_hours", "other"]
BLOOD_GROUPS_IN_THE_API_SPEC = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]


async def get_meta(client: AsyncClient) -> dict:
    response = await client.get("/meta")
    assert response.status_code == 200, response.text
    return response.json()


async def test_meta_needs_no_login(client: AsyncClient) -> None:
    response = await client.get("/meta")  # no Authorization header
    assert response.status_code == 200


async def test_meta_has_exactly_the_five_lists(client: AsyncClient) -> None:
    body = await get_meta(client)
    assert set(body) == {"areas", "categories", "services", "blood_groups", "report_reasons"}


async def test_meta_areas_are_the_fixed_list_in_order(client: AsyncClient) -> None:
    assert (await get_meta(client))["areas"] == settings.areas
    assert len((await get_meta(client))["areas"]) == 10


async def test_meta_categories_come_from_the_database_sorted_by_id(
    client: AsyncClient, session: AsyncSession
) -> None:
    # Created in an order that is neither alphabetical nor the seed's, so only "by id" explains the answer.
    for slug, name in (("pharmacy", "Pharmacy"), ("hospital", "Hospital"), ("clinic", "Clinic")):
        await category_repository.create(session, name=name, slug=slug, is_emergency=False, recheck_days=45)
    await session.commit()
    categories = (await get_meta(client))["categories"]
    assert [category["slug"] for category in categories] == ["pharmacy", "hospital", "clinic"]


async def add_category(session: AsyncSession, slug: str, name: str, is_emergency: bool = False) -> None:
    await category_repository.create(
        session, name=name, slug=slug, is_emergency=is_emergency, recheck_days=14 if is_emergency else 45
    )


async def test_meta_category_has_only_slug_name_and_is_emergency(
    client: AsyncClient, session: AsyncSession
) -> None:
    await add_category(session, "pharmacy", "Pharmacy")
    await session.commit()
    category = (await get_meta(client))["categories"][0]
    assert category == {"slug": "pharmacy", "name": "Pharmacy", "is_emergency": False}


async def test_meta_emergency_flag_is_kept(client: AsyncClient, session: AsyncSession) -> None:
    await add_category(session, "pharmacy", "Pharmacy")
    await add_category(session, "ambulance", "Ambulance", is_emergency=True)
    await session.commit()
    categories = (await get_meta(client))["categories"]
    assert {category["slug"]: category["is_emergency"] for category in categories} == {
        "pharmacy": False, "ambulance": True
    }


async def test_meta_with_no_categories_gives_an_empty_list(client: AsyncClient) -> None:
    body = await get_meta(client)
    assert body["categories"] == []
    assert body["services"] == []
    assert len(body["areas"]) == 10 and len(body["blood_groups"]) == 8 and len(body["report_reasons"]) == 6


async def test_meta_services_are_the_distinct_names_sorted_without_regard_to_case(
    client: AsyncClient, session: AsyncSession
) -> None:
    await add_listing(session, "Scan Centre", service_names=("X-ray", "Ultrasound", "consultation"))
    await add_listing(session, "Basic Clinic", service_names=("Malaria test", "Blood test"))
    await session.commit()
    # "consultation" sorts among the capitals (c after B, before M): the sort ignores case.
    assert (await get_meta(client))["services"] == [
        "Blood test", "consultation", "Malaria test", "Ultrasound", "X-ray"
    ]


async def test_meta_services_list_a_name_once_when_listings_share_it(
    client: AsyncClient, session: AsyncSession
) -> None:
    await add_listing(session, "Scan Centre", service_names=("X-ray",))
    await add_listing(session, "Second Scan Centre", service_names=("X-ray", "X-ray"))
    await session.commit()
    assert (await get_meta(client))["services"] == ["X-ray"]


async def test_meta_services_count_names_that_differ_only_in_capitals_once(
    client: AsyncClient, session: AsyncSession
) -> None:
    await add_listing(session, "Scan Centre", service_names=("x-ray",))
    await add_listing(session, "Second Scan Centre", service_names=("X-ray", "X-RAY"))
    await session.commit()
    assert (await get_meta(client))["services"] == ["X-RAY"]  # plain string order puts capitals first


@pytest.mark.parametrize(
    "spellings",
    [
        ("Xray", "X-ray"),
        ("Xray", "X-ray", " X-ray ", "x-ray", "XRAY"),
        (" X-ray ", "x-ray"),
        ("xray", "x-RAY"),
    ],
)
async def test_meta_merges_xray_and_x_ray(
    client: AsyncClient, session: AsyncSession, spellings: tuple[str, ...]
) -> None:
    for number, spelling in enumerate(spellings, start=1):
        await add_listing(session, f"Scan Place {number}", service_names=(spelling,))
    await session.commit()
    services = (await get_meta(client))["services"]
    assert len(services) == 1
    assert normalise_service_name(services[0]) == "xray"


async def test_meta_shows_the_first_spelling_in_plain_order_for_a_merged_service(
    client: AsyncClient, session: AsyncSession
) -> None:
    await add_listing(session, "Scan Place 1", service_names=("Xray", "xray"))
    await add_listing(session, "Scan Place 2", service_names=("X-ray",))
    await session.commit()
    assert (await get_meta(client))["services"] == ["X-ray"]  # "-" sorts before "r" in plain order


async def test_meta_keeps_services_that_differ_by_a_space_apart(
    client: AsyncClient, session: AsyncSession
) -> None:
    await add_listing(session, "Scan Place", service_names=("Xray", "X ray", "Pap smear", "Pap-smear"))
    await session.commit()
    assert (await get_meta(client))["services"] == ["Pap smear", "Pap-smear", "X ray", "Xray"]


async def test_meta_services_only_come_from_published_listings(
    client: AsyncClient, session: AsyncSession
) -> None:
    await add_listing(session, "Public Clinic", service_names=("Consultation",))
    for status in (
        ListingStatus.draft, ListingStatus.pending_review, ListingStatus.hidden, ListingStatus.recheck_due
    ):
        secret_service = f"Secret {status.value}"
        await add_listing(session, f"{status.value} clinic", status=status, service_names=(secret_service,))
    await session.commit()
    assert (await get_meta(client))["services"] == ["Consultation"]


async def test_meta_services_leave_out_the_blood_groups(client: AsyncClient, session: AsyncSession) -> None:
    # Blood groups are stored as service rows (CLAUDE.md); they have their own list.
    await add_listing(
        session, "Demo Blood Bank", category_slug="blood-bank",
        service_names=("Blood bank", *BLOOD_GROUPS_IN_THE_API_SPEC),
    )
    await session.commit()
    body = await get_meta(client)
    assert body["services"] == ["Blood bank"]
    assert body["blood_groups"] == BLOOD_GROUPS_IN_THE_API_SPEC


async def test_meta_services_skip_blank_names(client: AsyncClient, session: AsyncSession) -> None:
    await add_listing(session, "Odd Clinic", service_names=("", "   ", "  Consultation  "))
    await session.commit()
    assert (await get_meta(client))["services"] == ["Consultation"]


async def test_meta_services_are_empty_when_there_are_none(
    client: AsyncClient, session: AsyncSession
) -> None:
    await add_listing(session, "Plain Clinic")
    await session.commit()
    assert (await get_meta(client))["services"] == []


async def test_meta_services_use_a_fixed_number_of_queries(session: AsyncSession) -> None:
    async def count_queries() -> int:
        statements: list[str] = []

        def record(connection, cursor, statement, parameters, context, executemany) -> None:  # noqa: ANN001
            statements.append(statement)

        sync_engine = session.bind.sync_engine  # type: ignore[union-attr]
        event.listen(sync_engine, "before_cursor_execute", record)
        try:
            await meta_service.get_meta(session)
        finally:
            event.remove(sync_engine, "before_cursor_execute", record)
        return len(statements)

    await add_listing(session, "First Clinic", service_names=("Consultation",))
    await session.commit()
    with_one_listing = await count_queries()
    for number in range(2, 12):
        await add_listing(session, f"Clinic {number}", service_names=(f"Service {number}",))
    await session.commit()
    assert await count_queries() == with_one_listing  # not one query per listing


async def test_meta_blood_groups_are_the_eight_groups_in_the_api_spec_order(client: AsyncClient) -> None:
    assert (await get_meta(client))["blood_groups"] == BLOOD_GROUPS_IN_THE_API_SPEC


async def test_meta_report_reasons_match_the_api_spec_in_order(client: AsyncClient) -> None:
    assert (await get_meta(client))["report_reasons"] == REPORT_REASONS_IN_THE_API_SPEC


async def test_meta_is_tagged_public_in_docs() -> None:
    assert app.openapi()["paths"]["/meta"]["get"]["tags"] == ["Public"]
