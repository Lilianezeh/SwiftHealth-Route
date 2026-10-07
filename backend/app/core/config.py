from decimal import Decimal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://swifthealth:swifthealth@localhost:5432/swifthealth"
    jwt_secret: str = "dev-only-secret"
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


settings = Settings()
