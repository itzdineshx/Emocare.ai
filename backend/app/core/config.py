from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "EmoCare Sync API"
    environment: str = "development"
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "emocare"
    cors_origins: str = "http://localhost:5173"

    sync_poll_interval_seconds: int = 30
    auto_sync_source: str = ""
    auto_sync_url: str = ""
    auto_sync_api_key: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def parsed_cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
