import json

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..api_utils import fail, ok
from ..database import get_db
from ..deps import require_admin
from ..models import User
from ..services.audit_service import add_audit_log
from ..services.permission_service import DEFAULT_ROLE_PERMISSIONS, get_role_permissions, set_role_permissions

router = APIRouter(prefix="/api/permissions", tags=["permissions"])


@router.get("")
def get_permissions(db: Session = Depends(get_db), user: User = Depends(require_admin)):
    return ok({"permissions": get_role_permissions(db), "available": sorted({x for v in DEFAULT_ROLE_PERMISSIONS.values() for x in v})})


@router.put("")
def update_permissions(payload: dict, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    mapping = payload.get("permissions")
    if not isinstance(mapping, dict):
        raise fail("BAD_REQUEST", "permissions mapping required", status_code=400)

    clean: dict[str, list[str]] = {}
    for role, perms in mapping.items():
        if role not in {"admin", "manager", "staff", "viewer"}:
            continue
        if not isinstance(perms, list):
            continue
        clean[role] = sorted(set(str(x) for x in perms if isinstance(x, str) and x.strip()))

    if "users.manage" not in clean.get("admin", []):
        clean.setdefault("admin", []).append("users.manage")

    set_role_permissions(db, clean)
    add_audit_log(db, user=user, action="update", entity="permissions", entity_id="role_matrix", details={"permissions": clean})
    db.commit()
    return ok({"permissions": clean})
