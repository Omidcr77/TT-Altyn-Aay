import asyncio
import shutil
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path

from ..config import settings
from .monitoring_service import log_event, log_exception


@dataclass
class BackupItem:
    file: str
    size_bytes: int
    created_at: str


def _db_path() -> Path:
    raw = settings.database_url.replace("sqlite:///", "").strip()
    return Path(raw)


def ensure_backup_dir() -> Path:
    settings.backup_dir.mkdir(parents=True, exist_ok=True)
    return settings.backup_dir


def create_backup() -> Path:
    src = _db_path()
    if not src.exists():
        raise FileNotFoundError(f"database file not found: {src}")
    dst_dir = ensure_backup_dir()
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    dst = dst_dir / f"tt_altyn_aay_{ts}.db"
    shutil.copy2(src, dst)
    return dst


def list_backups() -> list[BackupItem]:
    dst_dir = ensure_backup_dir()
    items: list[BackupItem] = []
    for path in sorted(dst_dir.glob("*.db"), key=lambda p: p.stat().st_mtime, reverse=True):
        stat = path.stat()
        items.append(
            BackupItem(
                file=path.name,
                size_bytes=stat.st_size,
                created_at=datetime.utcfromtimestamp(stat.st_mtime).isoformat(),
            )
        )
    return items


def apply_retention() -> int:
    items = list_backups()
    if not items:
        return 0
    threshold = datetime.utcnow() - timedelta(days=max(settings.backup_retention_days, 1))
    deleted = 0
    for idx, item in enumerate(items):
        if idx < settings.backup_keep_min_count:
            continue
        created = datetime.fromisoformat(item.created_at)
        if created >= threshold:
            continue
        target = ensure_backup_dir() / item.file
        if target.exists():
            target.unlink()
            deleted += 1
    return deleted


def restore_backup(file_name: str) -> None:
    target = ensure_backup_dir() / file_name
    if not target.exists():
        raise FileNotFoundError("backup file not found")
    shutil.copy2(target, _db_path())


async def run_backup_scheduler() -> None:
    while True:
        try:
            path = create_backup()
            deleted = apply_retention()
            log_event("backup_tick", backup_file=path.name, retention_deleted=deleted)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            log_exception("backup_tick_failed", exc)
        await asyncio.sleep(max(settings.backup_interval_seconds, 300))
