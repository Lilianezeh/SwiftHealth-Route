from decimal import Decimal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://swifthealth:swifthealth@localhost:5432/swifthealth"
    jwt_secret: str = "dev-only-secret"
    jwt_minutes: int = 60 * 12
    cors_origins: str = "http://localhost:3000"
    paystack_secret_key: str = ""
    cloudinary_url: str = ""
    resend_api_key: str = ""
    termii_api_key: str = ""
    termii_sender_id: str = "SwiftHealth"
    featured_price_naira: Decimal = Decimal("5000.00")  # monthly featured price; set the real price in .env

    # Fixed list of areas (PRD: managed in settings, not a table)
    areas: list[str] = [
        "Independence Layout", "New Haven", "Trans-Ekulu", "GRA", "Ogui",
        "Uwani", "Achara Layout", "Abakpa Nike", "Emene", "Coal Camp",
    ]


settings = Settings()
