from pathlib import Path
from pydantic import BaseModel


class Settings(BaseModel):
    app_name: str = "TT Altyn Aay App"
    jwt_secret: str = "change-this-in-production"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 30
    refresh_token_days: int = 7
    database_url: str = "sqlite:///./tt_altyn_aay.db"
    excel_file: Path = Path("activities.xlsx")
    default_admin_username: str = "admin"
    default_admin_password: str = "Admin@12345"
    log_level: str = "INFO"
    error_tracking_webhook: str | None = None
    notification_rules_interval_seconds: int = 600
    notification_high_priority_threshold: int = 5
    notification_overdue_days: int = 0
    backup_dir: Path = Path("backups")
    backup_interval_seconds: int = 86400
    backup_retention_days: int = 14
    backup_keep_min_count: int = 5


settings = Settings()
