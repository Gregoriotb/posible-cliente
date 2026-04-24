from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "sqlite:///./artificialic.db"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    rate_limit_default: int = 60
    bootstrap_admin_on_empty: bool = True
    enable_docs: bool = True
    environment: str = "development"

    # Dashboard login (opcional). Si no están los 3, POST /v1/auth/login devuelve 503.
    admin_username: str | None = None
    admin_password: str | None = None
    admin_api_key: str | None = None

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def dashboard_login_enabled(self) -> bool:
        return all([self.admin_username, self.admin_password, self.admin_api_key])


settings = Settings()
