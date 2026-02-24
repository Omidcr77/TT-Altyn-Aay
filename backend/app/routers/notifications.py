from datetime import datetime

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from ..api_utils import ok
from ..auth import decode_token
from ..config import settings
from ..database import get_db
from ..deps import get_current_user, require_manager_or_admin
from ..models import Notification, SystemSetting, User
from ..services.notification_rules_service import run_notification_rules
from ..services.notification_service import notification_hub

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


def _to_int(value, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


@router.get("")
def list_notifications(db: Session = Depends(get_db), user: User = Depends(get_current_user), unread_only: bool = False):
    q = db.query(Notification).filter(Notification.user_id == user.id)
    if unread_only:
        q = q.filter(Notification.read_at.is_(None))
    rows = q.order_by(Notification.created_at.desc()).limit(50).all()
    unread_count = db.query(Notification).filter(Notification.user_id == user.id, Notification.read_at.is_(None)).count()
    return ok(
        {
            "items": [
                {
                    "id": x.id,
                    "activity_id": x.activity_id,
                    "type": x.type,
                    "text": x.text,
                    "read_at": x.read_at.isoformat() if x.read_at else None,
                    "created_at": x.created_at.isoformat(),
                }
                for x in rows
            ],
            "unread_count": unread_count,
        }
    )


@router.post("/{notification_id}/read")
def mark_read(notification_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.query(Notification).filter(Notification.id == notification_id, Notification.user_id == user.id).first()
    if row and not row.read_at:
        row.read_at = datetime.utcnow()
        db.commit()
    return ok({"id": notification_id})


@router.websocket("/ws")
async def notification_ws(websocket: WebSocket):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008)
        return
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise ValueError("bad type")
        username = payload.get("sub")
    except Exception:
        await websocket.close(code=1008)
        return
    db = next(get_db())
    try:
        user = db.query(User).filter(User.username == username).first()
    finally:
        db.close()
    if not user:
        await websocket.close(code=1008)
        return

    await notification_hub.connect(user.id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await notification_hub.disconnect(user.id, websocket)


@router.get("/rules")
def get_rules(db: Session = Depends(get_db), user: User = Depends(require_manager_or_admin)):
    keys = {
        "overdue_enabled": "notification_rule_overdue_enabled",
        "unassigned_enabled": "notification_rule_unassigned_enabled",
        "high_priority_enabled": "notification_rule_high_priority_enabled",
        "high_priority_threshold": "notification_high_priority_threshold",
        "overdue_days": "notification_overdue_days",
    }
    rows = db.query(SystemSetting).filter(SystemSetting.key.in_(keys.values())).all()
    data = {k: None for k in keys}
    raw_map = {x.key: x.value for x in rows}

    data["overdue_enabled"] = (raw_map.get(keys["overdue_enabled"], "true").lower() == "true")
    data["unassigned_enabled"] = (raw_map.get(keys["unassigned_enabled"], "true").lower() == "true")
    data["high_priority_enabled"] = (raw_map.get(keys["high_priority_enabled"], "true").lower() == "true")
    data["high_priority_threshold"] = _to_int(raw_map.get(keys["high_priority_threshold"]), settings.notification_high_priority_threshold)
    data["overdue_days"] = _to_int(raw_map.get(keys["overdue_days"]), settings.notification_overdue_days)
    return ok(data)


@router.post("/rules")
def upsert_rules(payload: dict, db: Session = Depends(get_db), user: User = Depends(require_manager_or_admin)):
    allowed = {
        "overdue_enabled": "notification_rule_overdue_enabled",
        "unassigned_enabled": "notification_rule_unassigned_enabled",
        "high_priority_enabled": "notification_rule_high_priority_enabled",
        "high_priority_threshold": "notification_high_priority_threshold",
        "overdue_days": "notification_overdue_days",
    }
    for key, setting_key in allowed.items():
        if key not in payload:
            continue
        value = payload.get(key)
        if isinstance(value, bool):
            store_value = "true" if value else "false"
        else:
            store_value = str(value)
        row = db.query(SystemSetting).filter(SystemSetting.key == setting_key).first()
        if row:
            row.value = store_value
        else:
            db.add(SystemSetting(key=setting_key, value=store_value))
    db.commit()
    return ok({"saved": True})


@router.post("/rules/run")
async def run_rules_now(db: Session = Depends(get_db), user: User = Depends(require_manager_or_admin)):
    summary = await run_notification_rules(db, push_live=True)
    return ok(summary)
