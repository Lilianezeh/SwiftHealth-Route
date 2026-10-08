from decimal import Decimal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_JWT_SECRET = "dev-only-secret"  # public: only for local development, never for anything deployed
MINIMUM_JWT_SECRET_BYTES = 32  # an HS256 key should be at least 32 bytes (RFC 7518 section 3.2)


class Settings(BaseSettings):
    # hide_input_in_errors: a validation error must not print the settings it was given (they hold secrets).
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", hide_input_in_errors=True)

    # "development" allows the default JWT secret. Any other value turns the secret check on (decision 12).
    app_env: str = "development"
    database_url: str = "postgresql+psycopg://swifthealth:swifthealth@localhost:5432/swifthealth"
    jwt_secret: str = DEFAULT_JWT_SECRET
    jwt_minutes: int = 60 * 12
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

    @model_validator(mode="after")
    def check_jwt_secret_outside_development(self) -> "Settings":
        """Refuses to start with a weak JWT secret outside development. The messages never show the secret."""
        if self.app_env == "development":
            return self
        setting_help = f"APP_ENV is '{self.app_env}', so set JWT_SECRET to a random value of 32+ bytes."
        if not self.jwt_secret:
            raise ValueError(f"JWT_SECRET is missing or empty. {setting_help}")
        if self.jwt_secret == DEFAULT_JWT_SECRET:
            raise ValueError(f"JWT_SECRET is missing or is still the development default. {setting_help}")
        secret_bytes = len(self.jwt_secret.encode())
        if secret_bytes < MINIMUM_JWT_SECRET_BYTES:
            raise ValueError(f"JWT_SECRET is only {secret_bytes} bytes. {setting_help}")
        return self


settings = Settings()
