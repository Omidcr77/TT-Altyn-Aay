import json
from datetime import date, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from ..api_utils import fail, loads_json, ok
from ..database import get_db
from ..deps import require_admin
from ..models import Activity, ActivityAssignment, AuditLog, Notification, Staff, User
from ..services.address_service import normalize_address, normalize_location
from ..services.audit_service import add_audit_log
from ..services.excel_service import sync_activity
from ..services.notification_service import notification_hub

router = APIRouter(prefix="/api/audit", tags=["audit"])

UNDOABLE_ACTIVITY_ACTIONS = {"create", "update", "delete", "mark_done", "reorder"}


def _activity_snapshot(a: Activity) -> dict:
    current_assignments = [x for x in a.assignments if x.is_current]
    return {
        "id": a.id,
        "created_by_user_id": a.created_by_user_id,
        "done_by_user_id": a.done_by_user_id,
        "done_at": a.done_at.isoformat() if a.done_at else None,
        "date": a.date.isoformat(),
        "activity_type": a.activity_type,
        "customer_name": a.customer_name,
        "location": (a.address or a.location or "-"),
        "address": (a.address or a.location or None),
        "status": a.status,
        "priority": a.priority,
        "report_text": a.report_text,
        "device_info": a.device_info,
        "extra_fields": loads_json(a.extra_fields_json),
        "assigned_staff_ids": [x.staff_id for x in current_assignments if x.staff_id],
    }


async def _notify_all_users(db: Session, text: str, activity_id: int | None, event_type: str) -> None:
    users = db.query(User).all()
    for u in users:
        db.add(Notification(user_id=u.id, activity_id=activity_id, type=event_type, text=text))
    db.commit()
    for u in users:
        await notification_hub.push(
            u.id,
            {"type": event_type, "text": text, "activity_id": activity_id, "created_at": datetime.utcnow().isoformat()},
        )


def _set_assignments(db: Session, activity: Activity, staff_ids: list[int], by_user_id: int) -> None:
    db.query(ActivityAssignment).filter(
        ActivityAssignment.activity_id == activity.id,
        ActivityAssignment.is_current.is_(True),
    ).update({"is_current": False})
    for sid in staff_ids:
        staff = db.query(Staff).filter(Staff.id == sid).first()
        if not staff:
            continue
        db.add(
            ActivityAssignment(
                activity_id=activity.id,
                staff_id=sid,
                assigned_by_user_id=by_user_id,
                is_current=True,
            )
        )


def _apply_snapshot(db: Session, row: Activity, snapshot: dict, by_user_id: int) -> None:
    row.date = date.fromisoformat(snapshot["date"])
    row.activity_type = snapshot.get("activity_type") or row.activity_type
    row.customer_name = snapshot.get("customer_name") or row.customer_name
    row.address = normalize_address(snapshot.get("address"), snapshot.get("location"))
    row.location = normalize_location(snapshot.get("location"), row.address)
    row.status = snapshot.get("status") or row.status
    row.priority = int(snapshot.get("priority") or 0)
    row.report_text = snapshot.get("report_text")
    row.device_info = snapshot.get("device_info")
    row.extra_fields_json = json.dumps(snapshot.get("extra_fields") or {}, ensure_ascii=False)

    done_at = snapshot.get("done_at")
    row.done_at = datetime.fromisoformat(done_at) if done_at else None
    row.done_by_user_id = snapshot.get("done_by_user_id")

    _set_assignments(db, row, [int(x) for x in snapshot.get("assigned_staff_ids") or []], by_user_id)


@router.get("")
def list_audit_logs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(require_admin),
):
    q = db.query(AuditLog).order_by(AuditLog.created_at.desc())
    total = q.count()
    rows = q.offset((page - 1) * page_size).limit(page_size).all()

    user_ids = {x.user_id for x in rows if x.user_id}
    user_map = {}
    if user_ids:
        user_map = {u.id: u.username for u in db.query(User).filter(User.id.in_(user_ids)).all()}

    items = []
    for x in rows:
        undoable = x.entity == "activity" and x.action in UNDOABLE_ACTIVITY_ACTIONS
        items.append(
            {
                "id": x.id,
                "user_id": x.user_id,
                "username": user_map.get(x.user_id),
                "action": x.action,
                "entity": x.entity,
                "entity_id": x.entity_id,
                "detail_json": x.detail_json,
                "undoable": undoable,
                "created_at": x.created_at.isoformat(),
            }
        )

    return ok({"items": items, "total": total, "page": page, "page_size": page_size})


@router.post("/{audit_id}/undo")
async def undo_audit(audit_id: int, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    log = db.query(AuditLog).filter(AuditLog.id == audit_id).first()
    if not log:
        raise fail("NOT_FOUND", "audit log not found", status_code=404)

    if log.entity != "activity" or log.action not in UNDOABLE_ACTIVITY_ACTIONS:
        raise fail("BAD_REQUEST", "this audit action is not undoable", status_code=400)

    details = {}
    if log.detail_json:
        try:
            details = json.loads(log.detail_json)
        except json.JSONDecodeError:
            details = {}

    activity_id = int(log.entity_id)

    if log.action == "create":
        row = db.query(Activity).filter(Activity.id == activity_id).first()
        if not row:
            raise fail("NOT_FOUND", "target activity not found", status_code=404)
        before = _activity_snapshot(row)
        db.delete(row)
        add_audit_log(db, user=user, action="undo_create", entity="activity", entity_id=str(activity_id), details={"target_audit_id": audit_id, "before": before})
        db.commit()
        await _notify_all_users(db, f"{user.username} undid create for activity #{activity_id}", activity_id, "audit_undo")
        return ok({"undone": True, "action": log.action, "activity_id": activity_id})

    if log.action == "delete":
        snap = details.get("before")
        if not isinstance(snap, dict):
            raise fail("BAD_REQUEST", "snapshot missing for undo", status_code=400)

        existing = db.query(Activity).filter(Activity.id == activity_id).first()
        if existing:
            raise fail("BAD_REQUEST", "activity id already exists; cannot restore delete", status_code=400)

        restored = Activity(
            id=activity_id,
            created_by_user_id=int(snap.get("created_by_user_id") or user.id),
            done_by_user_id=snap.get("done_by_user_id"),
            done_at=datetime.fromisoformat(snap["done_at"]) if snap.get("done_at") else None,
            date=date.fromisoformat(snap["date"]),
            activity_type=snap.get("activity_type") or "-",
            customer_name=snap.get("customer_name") or "-",
            location=normalize_location(snap.get("location"), snap.get("address")),
            address=normalize_address(snap.get("address"), snap.get("location")),
            status=snap.get("status") or "pending",
            priority=int(snap.get("priority") or 0),
            report_text=snap.get("report_text"),
            device_info=snap.get("device_info"),
            extra_fields_json=json.dumps(snap.get("extra_fields") or {}, ensure_ascii=False),
        )
        db.add(restored)
        db.flush()
        _set_assignments(db, restored, [int(x) for x in snap.get("assigned_staff_ids") or []], user.id)
        add_audit_log(db, user=user, action="undo_delete", entity="activity", entity_id=str(activity_id), details={"target_audit_id": audit_id, "after": snap})
        db.commit()
        sync_activity(db, restored.id)
        await _notify_all_users(db, f"{user.username} restored deleted activity #{activity_id}", activity_id, "audit_undo")
        return ok({"undone": True, "action": log.action, "activity_id": activity_id})

    snap = details.get("before")
    if not isinstance(snap, dict):
        raise fail("BAD_REQUEST", "snapshot missing for undo", status_code=400)

    row = db.query(Activity).options(joinedload(Activity.assignments)).filter(Activity.id == activity_id).first()
    if not row:
        raise fail("NOT_FOUND", "target activity not found", status_code=404)

    _apply_snapshot(db, row, snap, user.id)
    add_audit_log(db, user=user, action=f"undo_{log.action}", entity="activity", entity_id=str(activity_id), details={"target_audit_id": audit_id, "after": snap})
    db.commit()
    sync_activity(db, row.id)
    await _notify_all_users(db, f"{user.username} undid {log.action} for activity #{activity_id}", activity_id, "audit_undo")
    return ok({"undone": True, "action": log.action, "activity_id": activity_id})
