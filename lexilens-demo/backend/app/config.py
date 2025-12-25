
from typing import Optional

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
    # Optional image model for OpenRouter; falls back to `openrouter_model_id` when unset.
    openrouter_image_model_id: Optional[str] = None
    # Optional per-layer model overrides and a generic "fast" model for cheaper,
    # lower-latency calls. When unset, we fall back to `openrouter_model_id`.
    openrouter_fast_model_id: Optional[str] = None
    openrouter_layer3_model_id: Optional[str] = None
    openrouter_layer4_fast_model_id: Optional[str] = None
    openrouter_layer4_main_model_id: Optional[str] = None

    # Optional flags for vendor-specific reasoning / thinking modes.
    # These are wired through LLMOrchestrator and only applied to the
    # corresponding layer calls when explicitly enabled.
    openrouter_layer3_thinking_enabled: bool = False
    openrouter_layer4_thinking_enabled: bool = False

    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: list[str] = ["chrome-extension://*", "http://localhost:5173"]
    log_level: str = "INFO"

    max_retries: int = 3
    retry_delay: float = 1.0
    request_timeout: int = 60


settings = Settings()
