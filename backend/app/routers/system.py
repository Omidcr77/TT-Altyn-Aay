from fastapi import APIRouter, Depends

from ..api_utils import fail, ok
from ..deps import require_admin
from ..models import User
from ..services.backup_service import apply_retention, create_backup, list_backups, restore_backup

router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/backups")
def get_backups(user: User = Depends(require_admin)):
    return ok([x.__dict__ for x in list_backups()])


@router.post("/backups")
def create_backup_now(user: User = Depends(require_admin)):
    path = create_backup()
    deleted = apply_retention()
    return ok({"created": path.name, "retention_deleted": deleted})


@router.post("/backups/restore")
def restore_backup_now(payload: dict, user: User = Depends(require_admin)):
    name = str(payload.get("file") or "").strip()
    if not name:
        raise fail("BAD_REQUEST", "نام فایل backup ضروری است", status_code=400)
    try:
        restore_backup(name)
    except FileNotFoundError as exc:
        raise fail("NOT_FOUND", "backup پیدا نشد", status_code=404) from exc
    return ok({"restored": name})
