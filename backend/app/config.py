import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "AetherChat API"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("JWT_SECRET", os.getenv("JWT_SECRET_KEY", "super-secret-development-key-1234567890!"))
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Databases
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///aetherchat.db")

    # Cache / Queue broker
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # AI Provider Keys & Endpoints
    OPENAI_API_KEY: str | None = os.getenv("OPENAI_API_KEY")
    OPENAI_BASE_URL: str | None = os.getenv("OPENAI_BASE_URL")
    OPENAI_MODEL: str | None = os.getenv("OPENAI_MODEL")
    GEMINI_API_KEY: str | None = os.getenv("GEMINI_API_KEY", os.getenv("GOOGLE_API_KEY"))
    GOOGLE_API_KEY: str | None = os.getenv("GOOGLE_API_KEY")
    ANTHROPIC_API_KEY: str | None = os.getenv("ANTHROPIC_API_KEY")
    COHERE_API_KEY: str | None = os.getenv("COHERE_API_KEY")
    GROQ_API_KEY: str | None = os.getenv("GROQ_API_KEY")
    OPENROUTER_API_KEY: str | None = os.getenv("OPENROUTER_API_KEY")
    MISTRAL_API_KEY: str | None = os.getenv("MISTRAL_API_KEY")
    TOGETHER_API_KEY: str | None = os.getenv("TOGETHER_API_KEY")
    DEEPSEEK_API_KEY: str | None = os.getenv("DEEPSEEK_API_KEY")
    OLLAMA_BASE_URL: str | None = os.getenv("OLLAMA_BASE_URL")
    CUSTOM_API_URL: str | None = os.getenv("CUSTOM_API_URL")
    CUSTOM_API_KEY: str | None = os.getenv("CUSTOM_API_KEY")

    # Google OAuth
    GOOGLE_CLIENT_ID: str | None = os.getenv("GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET: str | None = os.getenv("GOOGLE_CLIENT_SECRET")

    # CORS Origins (Comma-separated string parsed to list)
    ALLOWED_ORIGINS: list[str] = [
        origin.strip() for origin in os.getenv(
            "ALLOWED_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8000,http://127.0.0.1:8000,https://samrat-ai.com,https://samrat-aethermind-v1.vercel.app"
        ).split(",") if origin.strip()
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

