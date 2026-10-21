"""Tests for integrations/cloudinary.py. Requirements: FR-32 (entrance photo), NFR-06 (no secrets leaked).
Decision C8 in specs/2026-10-20-staff-screens/requirements.md. Keys here are fictional.
"""

import pytest

from app.integrations.cloudinary import CloudinaryNotConfiguredError, parse_cloudinary_url, sign_parameters

CLOUDINARY_URL = "cloudinary://123456789012345:secret-not-real@demo-cloud"


def test_the_signature_matches_the_example_of_cloudinarys_documentation() -> None:
    """The example of "Manually generating authentication signatures": API secret abcd."""
    parameters = {
        "timestamp": "1315060510",
        "public_id": "sample_image",
        "eager": "w_400,h_300,c_pad|w_260,h_200,c_crop",
    }
    assert sign_parameters(parameters, "abcd") == "bfd09f95f331f558cbd1320e67aa8d488770583e"


def test_the_signature_does_not_depend_on_the_order_the_parameters_are_given_in() -> None:
    first = sign_parameters({"folder": "a", "timestamp": "1"}, "secret")
    second = sign_parameters({"timestamp": "1", "folder": "a"}, "secret")
    assert first == second


def test_a_different_secret_or_value_gives_a_different_signature() -> None:
    base = sign_parameters({"folder": "a", "timestamp": "1"}, "secret")
    assert base != sign_parameters({"folder": "a", "timestamp": "1"}, "other")
    assert base != sign_parameters({"folder": "b", "timestamp": "1"}, "secret")


def test_the_url_is_split_into_key_secret_and_cloud_name() -> None:
    settings = parse_cloudinary_url(CLOUDINARY_URL)
    assert (settings.api_key, settings.api_secret, settings.cloud_name) == (
        "123456789012345",
        "secret-not-real",
        "demo-cloud",
    )


@pytest.mark.parametrize(
    "bad",
    [
        "",
        "   ",
        "https://example.com",
        "cloudinary://onlykey@cloud",
        "cloudinary://key:secret@",
        "cloudinary://:secret@cloud",
    ],
)
def test_a_missing_or_broken_url_is_not_configured(bad: str) -> None:
    with pytest.raises(CloudinaryNotConfiguredError):
        parse_cloudinary_url(bad)


def test_the_error_never_contains_the_url() -> None:
    with pytest.raises(CloudinaryNotConfiguredError) as error:
        parse_cloudinary_url("cloudinary://key-123:secret-456@")
    assert "secret-456" not in str(error.value) and "key-123" not in str(error.value)
