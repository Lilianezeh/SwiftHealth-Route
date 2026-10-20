"""Cloudinary signed uploads: the phone sends the photo straight to Cloudinary.
Requirements: FR-32, US-10, NFR-06. Decision C8 in specs/2026-10-20-staff-screens/requirements.md.

A signature is the SHA-1 of the parameters to sign, sorted by name and written as `name=value` joined
with `&`, followed directly by the API secret (Cloudinary's "Manually generating authentication
signatures"; the test uses its example). `CLOUDINARY_URL` looks like
`cloudinary://<api_key>:<api_secret>@<cloud_name>`. The secret is never returned, logged or put in an
error. Not tested against a real account.
"""

import hashlib
from dataclasses import dataclass
from urllib.parse import urlparse


class CloudinaryNotConfiguredError(Exception):
    """CLOUDINARY_URL is missing or broken. The message never contains the URL."""


@dataclass(frozen=True)
class CloudinaryAccount:
    api_key: str
    api_secret: str
    cloud_name: str


def parse_cloudinary_url(url: str) -> CloudinaryAccount:
    """Splits `cloudinary://key:secret@cloud_name`. Raises CloudinaryNotConfiguredError if one is missing."""
    parts = urlparse(url.strip()) if url and url.strip() else None
    if (
        parts is None
        or parts.scheme != "cloudinary"
        or not parts.username
        or not parts.password
        or not parts.hostname
    ):
        raise CloudinaryNotConfiguredError(
            "CLOUDINARY_URL is not set or is not in the form cloudinary://key:secret@cloud"
        )
    return CloudinaryAccount(api_key=parts.username, api_secret=parts.password, cloud_name=parts.hostname)


def sign_parameters(parameters: dict[str, str], api_secret: str) -> str:
    """The signature of the parameters (all values as text), as a lower-case hex string."""
    to_sign = "&".join(f"{name}={parameters[name]}" for name in sorted(parameters))
    return hashlib.sha1(f"{to_sign}{api_secret}".encode()).hexdigest()  # noqa: S324 (Cloudinary's documented default)
