import json

from sqlalchemy.orm import Session

from ..models import SystemSetting, User

PERMISSIONS_KEY = "role_permissions_json"

DEFAULT_ROLE_PERMISSIONS = {
    "admin": [
        "activities.read",
        "activities.write",
        "activities.delete",
        "activities.bulk",
        "staff.manage",
        "master_data.manage",
        "settings.manage",
        "audit.read",
        "audit.undo",
        "users.manage",
    ],
    "manager": [
        "activities.read",
        "activities.write",
        "activities.bulk",
        "staff.manage",
        "audit.read",
    ],
    "staff": [
        "activities.read",
        "activities.write",
    ],
    "viewer": [
        "activities.read",
    ],
}


def get_role_permissions(db: Session) -> dict[str, list[str]]:
    row = db.query(SystemSetting).filter(SystemSetting.key == PERMISSIONS_KEY).first()
    if not row or not row.value:
        return DEFAULT_ROLE_PERMISSIONS
    try:
        data = json.loads(row.value)
        if isinstance(data, dict):
            out: dict[str, list[str]] = {}
            for role, perms in data.items():
                if isinstance(role, str) and isinstance(perms, list):
                    out[role] = [str(x) for x in perms]
            return out or DEFAULT_ROLE_PERMISSIONS
    except Exception:
        return DEFAULT_ROLE_PERMISSIONS
    return DEFAULT_ROLE_PERMISSIONS


def set_role_permissions(db: Session, mapping: dict[str, list[str]]) -> None:
    payload = json.dumps(mapping, ensure_ascii=False)
    row = db.query(SystemSetting).filter(SystemSetting.key == PERMISSIONS_KEY).first()
    if row:
        row.value = payload
    else:
        db.add(SystemSetting(key=PERMISSIONS_KEY, value=payload))


def user_has_permission(db: Session, user: User, permission: str) -> bool:
    role = (user.role or "").strip().lower()
    if role == "user":
        role = "staff"
    mapping = get_role_permissions(db)
    allowed = set(mapping.get(role, []))
    return permission in allowed
