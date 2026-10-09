from decimal import Decimal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# The eight blood groups, in the order of GET /meta. Blood banks store them as service rows (CLAUDE.md).
BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
DEFAULT_JWT_SECRET ="dev-only-secret"  # public: only for local development, never for anything deployed
DEFAULT_REPORTER_KEY_SECRET = "dev-only-reporter-key-secret"  # public: only for local development
# An HS256 key should be at least 32 bytes (RFC 7518 section 3.2). The reporter-key HMAC has the same minimum.
MINIMUM_SECRET_BYTES = 32


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
    paystack_secret_key: str = ""
    cloudinary_url: str = ""
    resend_api_key: str = ""
    termii_api_key: str = ""  # empty means local dev: the login code is logged instead of sent
    termii_base_url: str = ""  # per account, from the Termii dashboard; needed only when a key is set
    termii_sender_id: str = "SwiftHealth"
    termii_channel: str = "dnd"  # "dnd" reaches Do-Not-Disturb numbers but needs the DND route activated
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
