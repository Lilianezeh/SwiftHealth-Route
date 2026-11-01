"""Checks a request body that carries a visitor's position (NFR-07), for the POST twins of the search,
blood and emergency endpoints. Routes only: it raises HTTPException, which only routes may do.

FastAPI's own 422 for a body repeats the whole input, the position included. Here the body is checked by hand,
so a 422 names the field that is wrong and the rule it broke, and never repeats a value.
"""

from typing import Any, TypeVar

from fastapi import HTTPException, status
from pydantic import BaseModel, ValidationError

ParamsT = TypeVar("ParamsT", bound=BaseModel)


def params_from_body(model: type[ParamsT], body: dict[str, Any]) -> ParamsT:
    """The fields of `model` read from a JSON body, or a 422 that never repeats a value."""
    try:
        return model.model_validate(body)
    except ValidationError as error:
        problems = error.errors(include_url=False, include_context=False, include_input=False)
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            [
                {"loc": ["body", *problem["loc"]], "msg": problem["msg"], "type": problem["type"]}
                for problem in problems
            ],
        ) from None
