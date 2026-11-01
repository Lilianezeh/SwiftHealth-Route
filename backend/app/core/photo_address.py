"""Which photo addresses a listing may keep.
Requirements: FR-32, US-17, NFR-06. Decisions C8 (staff photos) and L3, L8 (owner photos).

A photo address is only ever an `https://res.cloudinary.com/` address (never another site, never with a user
name or a port). An owner's photo must also be in the owner folder of OUR Cloudinary account
(`swifthealth/owner-entrances`), so an owner cannot point the listing at somebody else's picture or at the
staff folder. Pure text checks: nothing is fetched.
"""

from urllib.parse import urlparse

CLOUDINARY_HOST = "res.cloudinary.com"
OWNER_PHOTO_FOLDER = "swifthealth/owner-entrances"


def is_cloudinary_address(address: str) -> bool:
    parts = urlparse(address)
    is_our_host = parts.scheme == "https" and parts.hostname == CLOUDINARY_HOST
    return is_our_host and not parts.username and not parts.port


def check_cloudinary_address(address: str | None) -> str | None:
    """A blank address means none. Any other must be an https://res.cloudinary.com/ address (staff photos)."""
    if address is None or not address.strip():
        return None
    if not is_cloudinary_address(address.strip()):
        raise ValueError("the photo must be an https://res.cloudinary.com/ address")
    return address.strip()


def check_owner_photo_address(address: str | None, cloud_name: str | None) -> str | None:
    """As above, and the address must be in the owner folder (and in our cloud, if its name is known)."""
    cleaned = check_cloudinary_address(address)
    if cleaned is None:
        return None
    path = urlparse(cleaned).path
    path_parts = [part for part in path.split("/") if part]
    if cloud_name is not None and (not path_parts or path_parts[0] != cloud_name):
        raise ValueError("the photo is not in our photo account")
    if f"/{OWNER_PHOTO_FOLDER}/" not in path:
        raise ValueError("the photo is not in the owner photo folder")
    return cleaned
