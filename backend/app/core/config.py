from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "EmoCare Sync API"
    environment: str = "development"
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "emocare"
    cors_origins: str = "http://localhost:3000,http://localhost:5173,https://emocare-child.vercel.app,https://emocare-mother.vercel.app"
    cors_origin_regex: str = ""

    sync_poll_interval_seconds: int = 30
    auto_sync_source: str = ""
    auto_sync_url: str = ""
    auto_sync_api_key: str = ""

    auth_required: bool = False
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def parsed_cors_origins(self) -> list[str]:
        normalized = self.cors_origins.replace("\n", ",").replace(";", ",")
        origins: list[str] = []
        for item in normalized.split(","):
            candidate = item.strip().strip('"').strip("'").rstrip("/")
            if candidate:
                origins.append(candidate)
        return origins


@lru_cache
def get_settings() -> Settings:
    return Settings()
