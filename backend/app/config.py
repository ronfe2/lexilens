
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    openrouter_api_key: str
    openrouter_model_id: str = "anthropic/claude-3.5-sonnet"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"

    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: list[str] = ["chrome-extension://*", "http://localhost:5173"]
    log_level: str = "INFO"

    max_retries: int = 3
    retry_delay: float = 1.0
    request_timeout: int = 60


settings = Settings()
