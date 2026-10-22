"""Demo data for the seed. Everything here is fictional: no real facility, no real phone number.

Pure data with no database access, so tests can check it without a database.
Requirement IDs: FR-15 (categories), FR-27 and FR-28 (blood), FR-31 (listing fields),
FR-33 (re-check cycle).
"""
import re
from dataclasses import dataclass
from datetime import date, time
from decimal import Decimal

from app.models.base import ListingStatus, Role

EMERGENCY_RECHECK_DAYS = 14  # FR-33
OTHER_RECHECK_DAYS = 45  # FR-33
FEES_COLLECTED_ON = date(2026, 9, 28)
BLOOD_GROUPS_CONFIRMED_ON = date(2026, 10, 1)
BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]

# Approximate centre of each area in core/config.py. Demo values, not surveyed.
AREA_CENTRES = {
    "Independence Layout": (6.4560, 7.5070),
    "New Haven": (6.4520, 7.5100),
    "Trans-Ekulu": (6.4600, 7.5300),
    "GRA": (6.4350, 7.4950),
    "Ogui": (6.4600, 7.4950),
    "Uwani": (6.4400, 7.5000),
    "Achara Layout": (6.4250, 7.5150),
    "Abakpa Nike": (6.4750, 7.5400),
    "Emene": (6.4900, 7.5600),
    "Coal Camp": (6.4300, 7.4900),
}


@dataclass(frozen=True)
class CategorySeed:
    slug: str
    name: str
    is_emergency: bool

    @property
    def recheck_days(self) -> int:
        return EMERGENCY_RECHECK_DAYS if self.is_emergency else OTHER_RECHECK_DAYS


@dataclass(frozen=True)
class UserSeed:
    name: str
    email: str
    phone: str
    role: Role


@dataclass(frozen=True)
class PhoneSeed:
    number: str
    label: str
    is_primary: bool


@dataclass(frozen=True)
class HoursSeed:
    day_of_week: int  # 0 = Monday
    opens_at: time | None
    closes_at: time | None
    is_closed: bool


@dataclass(frozen=True)
class ServiceSeed:
    name: str
    fee_min_naira: Decimal | None
    fee_max_naira: Decimal | None
    collected_at: date | None  # fee date, or the date blood groups were confirmed


@dataclass(frozen=True)
class ListingSeed:
    slug: str
    name: str
    category_slug: str
    area: str
    address: str
    landmark: str | None
    latitude: float
    longitude: float
    description: str
    status: ListingStatus
    is_24_hours: bool
    phones: tuple[PhoneSeed, ...]
    opening_hours: tuple[HoursSeed, ...]
    services: tuple[ServiceSeed, ...]
    verified_days_ago: int | None  # None: never verified (draft or hidden)
    owned_by_provider: bool


def demo_phone(number: int) -> str:
    """+234 then ten digits that start with zeros, e.g. +2340000000012.
    Real Nigerian numbers never have a zero straight after +234, so these can never be real."""
    return f"+234{number:010d}"


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


# --- categories (FR-15: emergency groups; FR-01: everyday groups) ---

CATEGORIES = (
    CategorySeed("hospital", "Hospital", False),
    CategorySeed("clinic", "Clinic", False),
    CategorySeed("pharmacy", "Pharmacy", False),
    CategorySeed("maternity", "Maternity", False),
    CategorySeed("laboratory", "Laboratory", False),
    CategorySeed("ambulance", "Ambulance", True),
    CategorySeed("fire", "Fire service", True),
    CategorySeed("police", "Police", True),
    CategorySeed("emergency-unit", "Hospital emergency (24 hours)", True),
    CategorySeed("roadside-assistance", "Road accidents", True),
    CategorySeed("security", "Security", True),
    CategorySeed("blood-bank", "Blood bank", True),
    # SwiftRescue groups of 2026-10-22 (specs/2026-10-22-swiftrescue-groups/). No demo contact and no
    # phone number for them: staff add verified contacts later. The same three rows are added to a live
    # database by the revision c3d71e9b5a20.
    CategorySeed("disaster-flooding", "Disaster and flooding", True),
    CategorySeed("gbv-support", "Sexual and gender-based violence support", True),
    CategorySeed("mental-health-crisis", "Mental health crisis support", True),
)
EMERGENCY_CATEGORY_SLUGS = {category.slug for category in CATEGORIES if category.is_emergency}


# --- users: one per role. Passwords are NOT here; they come from the environment ---

USERS = (
    UserSeed("Demo Verifier", "verifier@demo.swifthealth.example", demo_phone(901), Role.verifier),
    UserSeed("Demo Editor", "editor@demo.swifthealth.example", demo_phone(902), Role.editor),
    UserSeed("Demo Admin", "admin@demo.swifthealth.example", demo_phone(903), Role.admin),
    UserSeed("Demo Provider", "provider@demo.swifthealth.example", demo_phone(904), Role.provider),
)


# --- small builders so the listing table below stays readable ---

def weekly_hours(opens: str, closes: str, closed_days: tuple[int, ...] = ()) -> tuple[HoursSeed, ...]:
    """Same hours every day. A closing time earlier than the opening time runs past midnight."""
    return tuple(
        HoursSeed(day, None, None, True) if day in closed_days
        else HoursSeed(day, time.fromisoformat(opens), time.fromisoformat(closes), False)
        for day in range(7)
    )


ALL_DAY = weekly_hours("00:00", "23:59")  # how a 24-hour listing is stored (same as the spike)
SUNDAY = 6


def fee_service(name: str, fee_min: str, fee_max: str) -> ServiceSeed:
    return ServiceSeed(name, Decimal(fee_min), Decimal(fee_max), FEES_COLLECTED_ON)


def plain_service(name: str) -> ServiceSeed:
    return ServiceSeed(name, None, None, None)


def blood_group_services(groups: tuple[str, ...]) -> tuple[ServiceSeed, ...]:
    """Blood groups are stored as service rows; the date is when the group list was confirmed."""
    return tuple(ServiceSeed(group, None, None, BLOOD_GROUPS_CONFIRMED_ON) for group in groups)


def build_listing(
    number: int,
    name: str,
    category_slug: str,
    area: str,
    opening_hours: tuple[HoursSeed, ...],
    services: tuple[ServiceSeed, ...] = (),
    *,
    is_24_hours: bool = False,
    status: ListingStatus = ListingStatus.published,
    verified_days_ago: int | None = 3,
    second_phone: bool = False,
    owned_by_provider: bool = False,
) -> ListingSeed:
    """number is unique per listing: it makes the phone numbers and map position different."""
    centre_latitude, centre_longitude = AREA_CENTRES[area]
    main_label = "Emergency" if category_slug in EMERGENCY_CATEGORY_SLUGS else "Front desk"
    phones = [PhoneSeed(demo_phone(number), main_label, True)]
    if second_phone:
        phones.append(PhoneSeed(demo_phone(100 + number), "Reception", False))
    return ListingSeed(
        slug=slugify(f"{name} {area}"),
        name=name,
        category_slug=category_slug,
        area=area,
        address=f"{number} Example Road",
        landmark="Demo landmark: near the example junction",
        latitude=round(centre_latitude + (number % 5) * 0.0015, 4),
        longitude=round(centre_longitude + (number % 3) * 0.0015, 4),
        description=f"Demo data (fictional): {name} is not a real facility.",
        status=status,
        is_24_hours=is_24_hours,
        phones=tuple(phones),
        opening_hours=opening_hours,
        services=services,
        verified_days_ago=verified_days_ago if status == ListingStatus.published else None,
        owned_by_provider=owned_by_provider,
    )


# --- 30 listings across all 10 areas ---

LISTINGS = (
    # Hospitals (4). The first also runs a blood bank service (FR-27).
    build_listing(
        1, "Demo General Hospital", "hospital", "GRA", ALL_DAY,
        (
            fee_service("Consultation", "3000.00", "8000.00"),
            fee_service("X-ray", "5000.00", "12000.00"),
            fee_service("Ultrasound", "6000.00", "15000.00"),
            plain_service("Blood bank"),
            *blood_group_services(("O+", "O-", "A+", "B+")),
        ),
        is_24_hours=True, second_phone=True,
    ),
    build_listing(
        2, "Demo Teaching Hospital", "hospital", "Ogui", weekly_hours("07:00", "18:00", (SUNDAY,)),
        (fee_service("Consultation", "2500.00", "6000.00"), fee_service("X-ray", "4500.00", "10000.00")),
    ),
    build_listing(
        3, "Demo Community Hospital", "hospital", "Emene", weekly_hours("08:00", "20:00"),
        (fee_service("Consultation", "2000.00", "5000.00"), fee_service("Ultrasound", "5000.00", "12000.50")),
    ),
    build_listing(
        4, "Demo Specialist Hospital", "hospital", "Independence Layout", ALL_DAY,
        (fee_service("Consultation", "5000.00", "15000.00"), fee_service("X-ray", "6000.00", "14000.00")),
        is_24_hours=True,
    ),
    # Clinics (3). The eye clinic is still a draft.
    build_listing(
        5, "Demo Family Clinic", "clinic", "New Haven", weekly_hours("08:00", "20:00"),
        (
            fee_service("Consultation", "1500.00", "4000.00"),
            fee_service("Malaria test", "1500.00", "3000.00"),
        ),
    ),
    build_listing(
        6, "Demo Child Care Clinic", "clinic", "Uwani", weekly_hours("09:00", "17:00", (SUNDAY,)),
        (fee_service("Consultation", "2000.00", "4500.00"),),
    ),
    build_listing(
        7, "Demo Eye Clinic", "clinic", "Trans-Ekulu", weekly_hours("09:00", "16:00", (SUNDAY,)),
        (fee_service("Eye test", "2000.00", "5000.00"),), status=ListingStatus.draft,
    ),
    # Pharmacies (7): 3 open past midnight, 2 open 24 hours, 1 overdue for re-check, 1 hidden.
    build_listing(
        8, "Demo Night Pharmacy", "pharmacy", "New Haven", weekly_hours("20:00", "02:00"),
        owned_by_provider=True, second_phone=True,
    ),
    build_listing(9, "Demo Late Pharmacy", "pharmacy", "Abakpa Nike", weekly_hours("18:00", "01:00")),
    build_listing(
        10, "Demo Midnight Pharmacy", "pharmacy", "Independence Layout", weekly_hours("21:00", "03:00")
    ),
    build_listing(11, "Demo 24 Hour Pharmacy", "pharmacy", "Ogui", ALL_DAY, is_24_hours=True),
    build_listing(12, "Demo Round the Clock Pharmacy", "pharmacy", "GRA", ALL_DAY, is_24_hours=True),
    build_listing(  # published, but 60 days since the last check: shows "verification due" (FR-08)
        13, "Demo Day Pharmacy", "pharmacy", "Achara Layout", weekly_hours("08:00", "21:00"),
        verified_days_ago=60,
    ),
    build_listing(  # hidden: failed its last re-check, so the public never sees it
        14, "Demo Corner Pharmacy", "pharmacy", "Coal Camp", weekly_hours("08:00", "20:00"),
        status=ListingStatus.hidden,
    ),
    # Maternity (2)
    build_listing(
        15, "Demo Mother and Child Centre", "maternity", "Uwani", ALL_DAY,
        (
            fee_service("Antenatal care", "2000.00", "5000.00"),
            fee_service("Delivery", "30000.00", "80000.00"),
        ),
        is_24_hours=True,
    ),
    build_listing(
        16, "Demo Maternity Home", "maternity", "Abakpa Nike", weekly_hours("08:00", "18:00"),
        (fee_service("Antenatal care", "1500.00", "4000.00"),),
    ),
    # Laboratories (2)
    build_listing(
        17, "Demo Diagnostics Lab", "laboratory", "Independence Layout",
        weekly_hours("07:00", "19:00", (SUNDAY,)),
        (
            fee_service("Malaria test", "1500.00", "3000.00"),
            fee_service("Typhoid test", "2000.00", "4000.00"),
        ),
    ),
    build_listing(
        18, "Demo Quick Lab", "laboratory", "Trans-Ekulu", weekly_hours("08:00", "17:00"),
        (fee_service("Malaria test", "1200.00", "2800.00"), fee_service("Blood count", "2500.00", "5000.00")),
    ),
    # Emergency contacts (9): always open, listed in SwiftRescue
    build_listing(19, "Demo Ambulance Service One", "ambulance", "GRA", ALL_DAY, is_24_hours=True),
    build_listing(20, "Demo Ambulance Service Two", "ambulance", "Emene", ALL_DAY, is_24_hours=True),
    build_listing(21, "Demo Fire Station", "fire", "Coal Camp", ALL_DAY, is_24_hours=True),
    build_listing(22, "Demo Police Post", "police", "Ogui", ALL_DAY, is_24_hours=True),
    build_listing(23, "Demo Police Division", "police", "Uwani", ALL_DAY, is_24_hours=True),
    build_listing(
        24, "Demo Emergency Care Unit", "emergency-unit", "New Haven", ALL_DAY,
        (plain_service("Emergency care"),), is_24_hours=True,
    ),
    build_listing(
        25, "Demo Trauma Unit", "emergency-unit", "Trans-Ekulu", ALL_DAY,
        (plain_service("Emergency care"),), is_24_hours=True,
    ),
    build_listing(
        26, "Demo Roadside Rescue", "roadside-assistance", "Independence Layout", ALL_DAY, is_24_hours=True
    ),
    build_listing(27, "Demo Community Security Desk", "security", "Achara Layout", ALL_DAY, is_24_hours=True),
    # Blood banks (3). Two also accept donors (FR-28).
    build_listing(
        28, "Demo Blood Bank Central", "blood-bank", "Ogui", weekly_hours("08:00", "20:00"),
        (plain_service("Blood donation"), *blood_group_services(tuple(BLOOD_GROUPS))),
    ),
    build_listing(
        29, "Demo Blood Bank North", "blood-bank", "Abakpa Nike", weekly_hours("08:00", "18:00", (SUNDAY,)),
        (plain_service("Blood donation"), *blood_group_services(("A+", "B+", "O+"))),
    ),
    build_listing(
        30, "Demo Blood Bank GRA", "blood-bank", "GRA", weekly_hours("09:00", "17:00"),
        blood_group_services(("O+", "O-", "AB+")),
    ),
)
