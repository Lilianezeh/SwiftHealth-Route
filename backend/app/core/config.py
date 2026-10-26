from decimal import Decimal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# The eight blood groups, in the order of GET /meta. Blood banks store them as service rows (CLAUDE.md).
BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
DEFAULT_JWT_SECRET ="dev-only-secret"  # public: only for local development, never for anything deployed
DEFAULT_REPORTER_KEY_SECRET = "dev-only-reporter-key-secret"  # public: only for local development
# An HS256 key should be at least 32 bytes (RFC 7518 section 3.2). The reporter-key HMAC has the same minimum.
MINIMUM_SECRET_BYTES = 32
# The map pin of a draft that came from "List your facility" (FR-37): the form cannot give a position
# and a listing cannot have none. The centre of the pilot city; a verifier sets the real pin (decision C5
# in specs/2026-10-20-staff-screens/requirements.md). It is only a point on the map, not a city name.
DEFAULT_MAP_CENTRE: tuple[float, float] = (6.4584, 7.5464)  # latitude, longitude
# Registering a facility (FR-51, decision D15): a listing in the same area whose name has this pg_trgm
# `similarity` (0 to 1, the whole name against the whole name) with the new name stops the registration.
# 0.6 is high on purpose: "Example Clinic" and "Example Clinic Ltd" match, "Good Life Pharmacy" and
# "Good Health Pharmacy" do not, and a wrong stop only sends the person to claim or contact us.
DUPLICATE_NAME_SIMILARITY = 0.6
# The claim search shows at most this many listings (api-spec section 7, "Phase 7").
CLAIMABLE_RESULT_LIMIT = 10
# Netlify builds each pull request at https://deploy-preview-<number>--swifthealth-ng.netlify.app.
# The API lets exactly those addresses call it, so a preview works without listing every number in
# CORS_ORIGINS (NFR-06). The whole address must match: https, digits only, this site's name, no port.
# Branch deploys are not allowed.
NETLIFY_PREVIEW_ORIGIN_REGEX = r"https://deploy-preview-[0-9]+--swifthealth-ng\.netlify\.app"


class Settings(BaseSettings):
    # hide_input_in_errors: a validation error must not print the settings it was given (they hold secrets).
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", hide_input_in_errors=True)

    # "development" allows the default JWT secret. Any other value turns the secret check on (decision 12).
    app_env: str = "development"
    database_url: str = "postgresql+psycopg://swifthealth:swifthealth@localhost:5432/swifthealth"
    jwt_secret: str = DEFAULT_JWT_SECRET
    jwt_minutes: int = 60 * 12
    # Keys the hash that counts different reporters for FR-22. Separate from JWT_SECRET on purpose: rotating
    # the JWT secret must not break the counting. In development a blank value means the development default.
    reporter_key_secret: str = DEFAULT_REPORTER_KEY_SECRET
    cors_origins: str = "http://localhost:3000"
    # Proxies in front of the API that append to X-Forwarded-For. Not yet checked on Render (see LOG.md).
    trusted_proxy_count: int = Field(default=1, ge=1)
    # A TEST key (sk_test_...): integrations/paystack.py refuses a live key.
    paystack_secret_key: str = ""
    # Where Paystack sends the provider back after paying. Empty: the first CORS origin (the web address).
    web_app_url: str = ""
    cloudinary_url: str = ""  # cloudinary://key:secret@cloud_name; empty means photo upload is not set up
    # An upload preset made in the Cloudinary account (images only, at most 5 MB). Empty: none is sent.
    cloudinary_upload_preset: str = ""
    resend_api_key: str = ""  # empty means no email is sent (the staff alert of FR-22 is only logged)
    resend_from_email: str = ""  # a sender on a domain verified in Resend; empty: no email
    termii_api_key: str = ""  # empty means local dev: the login code is logged instead of sent
    termii_base_url: str = ""  # per account, from the Termii dashboard; needed only when a key is set
    termii_sender_id: str = "SwiftHealth"
    termii_channel: str = "dnd"  # "dnd" reaches Do-Not-Disturb numbers but needs the DND route activated
    # Sign-up (FR-48): closed unless this is true. Off in production until the owner opens it (after the
    # Privacy page was reviewed by a lawyer, and Resend and Termii are set up): until then sign-up answers
    # 503 "Sign-up is not open yet."
    signup_enabled: bool = False
    # Encrypts the authenticator-app secret in the database (FR-58): a Fernet key, 32 random bytes in URL-safe
    # base64 (how to make one without a file: specs/2026-10-23-accounts-and-facility-ownership/
    # requirements.md, 5c). Empty in development uses a public development key; empty elsewhere means the
    # app set-up answers "not available yet".
    totp_encryption_key: str = ""
    featured_price_naira: Decimal = Decimal("5000.00")  # monthly featured price; set the real price in .env

    # Fixed list of areas (PRD: managed in settings, not a table)
    areas: list[str] = [
        "Independence Layout", "New Haven", "Trans-Ekulu", "GRA", "Ogui",
        "Uwani", "Achara Layout", "Abakpa Nike", "Emene", "Coal Camp",
    ]

    @field_validator("database_url")
    @classmethod
    def use_psycopg_driver(cls, database_url: str) -> str:
        """Render gives `postgresql://...`. SQLAlchemy would pick a driver we lack, so name psycopg."""
        plain_prefix = "postgresql://"
        if database_url.startswith(plain_prefix):
            return "postgresql+psycopg://" + database_url.removeprefix(plain_prefix)
        return database_url

    @property
    def cors_origin_list(self) -> list[str]:
        """CORS_ORIGINS is one comma-separated string in the environment; the middleware needs a list."""
        return [origin.strip() for origin in self.cors_origins.split(",")]

    @property
    def featured_price(self) -> Decimal:
        """The monthly featured price with exactly 2 decimals, e.g. Decimal("5000.00") (CLAUDE.md, money)."""
        return self.featured_price_naira.quantize(Decimal("0.01"))

    @property
    def web_app_address(self) -> str:
        """The web app's address without a closing slash: WEB_APP_URL, else the first CORS origin."""
        return (self.web_app_url.strip() or self.cors_origin_list[0]).rstrip("/")

    @model_validator(mode="after")
    def check_secrets_outside_development(self) -> "Settings":
        """Refuses to start with a weak secret outside development. The messages never show a secret value."""
        if self.app_env == "development":
            if not self.reporter_key_secret:  # a blank REPORTER_KEY_SECRET, as in .env.example
                self.reporter_key_secret = DEFAULT_REPORTER_KEY_SECRET
            return self
        reporter_default = DEFAULT_REPORTER_KEY_SECRET
        problems = [
            *self._secret_problems("JWT_SECRET", self.jwt_secret, DEFAULT_JWT_SECRET),
            *self._secret_problems("REPORTER_KEY_SECRET", self.reporter_key_secret, reporter_default),
        ]
        if not problems and self.reporter_key_secret == self.jwt_secret:
            problems.append("REPORTER_KEY_SECRET must differ from JWT_SECRET, so one leak opens only one.")
        if problems:
            raise ValueError(" ".join(problems))
        return self

    def _secret_problems(self, variable: str, secret: str, development_default: str) -> list[str]:
        setting_help = f"APP_ENV is '{self.app_env}', so set {variable} to a random value of 32+ bytes."
        if not secret:
            return [f"{variable} is missing or empty. {setting_help}"]
        if secret == development_default:
            return [f"{variable} is missing or is still the development default. {setting_help}"]
        secret_bytes = len(secret.encode())
        if secret_bytes < MINIMUM_SECRET_BYTES:
            return [f"{variable} is only {secret_bytes} bytes. {setting_help}"]
        return []


settings = Settings()
