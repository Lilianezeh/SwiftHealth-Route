"""Every router tag in /docs starts with a capital letter (CLAUDE.md, "Code style").
No PRD requirement: docs only.

Tags are only labels: the endpoint paths are checked by the route tests and do not change.
"""
from app.main import app


def all_tags() -> set[str]:
    paths = app.openapi()["paths"].values()
    return {tag for path in paths for operation in path.values() for tag in operation["tags"]}


def test_every_tag_starts_with_a_capital_letter() -> None:
    tags = all_tags()
    assert tags  # the app has tagged routes
    assert all(tag[0].isupper() for tag in tags), sorted(tags)


def test_the_search_route_is_tagged_search_and_health_is_tagged_health() -> None:
    paths = app.openapi()["paths"]
    assert paths["/search"]["get"]["tags"] == ["Search"]
    assert paths["/health"]["get"]["tags"] == ["Health"]
