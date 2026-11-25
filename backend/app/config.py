from datetime import time

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./dev.db"
    jwt_secret: str = "change-me"
    staff_username: str = "admin"
    staff_password: str = "admin"
    camera_api_key: str = "change-me-camera"
    cors_origins: str = "http://localhost:5173"

    timezone: str = "Europe/Warsaw"
    open_time: time = time(12, 0)
    close_time: time = time(22, 0)
    reservation_minutes: int = 90
    slot_step_minutes: int = 30
    occupancy_ttl_seconds: int = 120  # po tym czasie status z kamery uznajemy za nieaktualny
    seed_demo: bool = True


settings = Settings()
