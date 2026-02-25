import os
from pathlib import Path

from pydantic import BaseModel


def _env(key: str, default: str | None = None) -> str | None:
    return os.getenv(key, default)


def _env_int(key: str, default: int) -> int:
    raw = os.getenv(key)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _env_bool(key: str, default: bool) -> bool:
    raw = os.getenv(key)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_list(key: str, default: list[str]) -> list[str]:
    raw = os.getenv(key)
    if raw is None:
        return default
    return [x.strip() for x in raw.split(",") if x.strip()]


class Settings(BaseModel):
    app_name: str = _env("APP_NAME", "TT Altyn Aay App") or "TT Altyn Aay App"
    app_env: str = (_env("APP_ENV", "development") or "development").lower()

    jwt_secret: str = _env("JWT_SECRET", "change-this-in-production") or "change-this-in-production"
    jwt_algorithm: str = _env("JWT_ALGORITHM", "HS256") or "HS256"
    access_token_minutes: int = _env_int("ACCESS_TOKEN_MINUTES", 30)
    refresh_token_days: int = _env_int("REFRESH_TOKEN_DAYS", 7)

    database_url: str = _env("DATABASE_URL", "sqlite:///./tt_altyn_aay.db") or "sqlite:///./tt_altyn_aay.db"
    excel_file: Path = Path(_env("EXCEL_FILE", "activities.xlsx") or "activities.xlsx")

    default_admin_username: str = _env("DEFAULT_ADMIN_USERNAME", "admin") or "admin"
    default_admin_password: str = _env("DEFAULT_ADMIN_PASSWORD", "Admin@12345") or "Admin@12345"
    disable_default_seeding: bool = _env_bool("DISABLE_DEFAULT_SEEDING", False)

    log_level: str = _env("LOG_LEVEL", "INFO") or "INFO"
    error_tracking_webhook: str | None = _env("ERROR_TRACKING_WEBHOOK", None)

    notification_rules_interval_seconds: int = _env_int("NOTIFICATION_RULES_INTERVAL_SECONDS", 600)
    notification_high_priority_threshold: int = _env_int("NOTIFICATION_HIGH_PRIORITY_THRESHOLD", 5)
    notification_overdue_days: int = _env_int("NOTIFICATION_OVERDUE_DAYS", 0)

    backup_dir: Path = Path(_env("BACKUP_DIR", "backups") or "backups")
    backup_interval_seconds: int = _env_int("BACKUP_INTERVAL_SECONDS", 86400)
    backup_retention_days: int = _env_int("BACKUP_RETENTION_DAYS", 14)
    backup_keep_min_count: int = _env_int("BACKUP_KEEP_MIN_COUNT", 5)

    cors_origins: list[str] = _env_list("CORS_ORIGINS", ["*"])
    trusted_hosts: list[str] = _env_list("TRUSTED_HOSTS", ["*"])


settings = Settings()


if settings.app_env == "production":
    if settings.jwt_secret == "change-this-in-production":
        raise RuntimeError("JWT_SECRET must be changed in production")
    if settings.default_admin_password == "Admin@12345":
        raise RuntimeError("DEFAULT_ADMIN_PASSWORD must be changed in production")
