"""One settings module: the only place environment variables are read.

Every secret arrives here from the host environment (or a local .env, which
is git-ignored). Defaults are safe for local development only — AUTH_SECRET
must be set in any deployed environment.
"""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "dev"
    database_url: str = "sqlite:///./data/sathi.db"
    auth_secret: str = "dev-only-not-a-secret-change-me-32b"
    # Comma-separated. The Capacitor origin (https://localhost) and the local
    # dev origin are always allowed (architecture §5 / ADR-04).
    allowed_origins: str = ""
    llm_provider: str = "none"          # "none" | "openai-compatible"
    llm_api_key: str = ""
    llm_model: str = ""
    llm_enabled: bool = False           # kill switch (P0)
    llm_daily_cap: int = 200
    git_commit: str = "unknown"
    token_ttl_minutes: int = 120        # short-lived demo JWT

    @property
    def cors_origins(self) -> list[str]:
        origins = {"https://localhost", "http://localhost:3000", "http://127.0.0.1:3000"}
        for o in self.allowed_origins.split(","):
            o = o.strip()
            if o:
                origins.add(o)
        return sorted(origins)


@lru_cache
def get_settings() -> Settings:
    return Settings()
