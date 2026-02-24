import json
from datetime import date
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, case, desc, func, or_
from sqlalchemy.orm import Session, joinedload

from ..api_utils import fail, loads_json, ok
from ..database import get_db
from ..deps import get_current_user, normalize_role, require_editor, require_manager_or_admin
from ..models import Activity, ActivityAssignment, Notification, Staff, SystemSetting, User
from ..schemas import ActivityCreate, ActivityUpdate
from ..services.address_service import normalize_address, normalize_location
from ..services.audit_service import add_audit_log
from ..services.email_service import send_new_activity_email
from ..services.excel_service import sync_activity
from ..services.notification_service import notification_hub
from ..services.search_service import normalize_sql_expr, normalize_text

router = APIRouter(prefix="/api/activities", tags=["activities"])


def _activity_to_dict(a: Activity) -> dict:
    current_assignments = [x for x in a.assignments if x.is_current]
    return {
        "id": a.id,
        "created_at": a.created_at.isoformat(),
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
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
        "assigned_staff": [
            {"id": item.staff.id, "name": item.staff.name, "phone": item.staff.phone, "active": item.staff.active}
            for item in current_assignments
            if item.staff
        ],
    }


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


def _changed_fields(before: dict, after: dict) -> list[str]:
    keys = [
        "date",
        "activity_type",
        "customer_name",
        "location",
        "address",
        "status",
        "priority",
        "report_text",
        "device_info",
        "extra_fields",
        "assigned_staff_ids",
        "done_by_user_id",
        "done_at",
    ]
    return [k for k in keys if before.get(k) != after.get(k)]


def _set_assignments(db: Session, activity: Activity, staff_ids: list[int], by_user_id: int) -> None:
    db.query(ActivityAssignment).filter(
        ActivityAssignment.activity_id == activity.id,
        ActivityAssignment.is_current.is_(True),
    ).update({"is_current": False})
    for sid in staff_ids:
        staff = db.query(Staff).filter(Staff.id == sid, Staff.active.is_(True)).first()
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


async def _notify_all_users(db: Session, text: str, activity_id: int | None, event_type: str) -> None:
    users = db.query(User).all()
    for u in users:
        note = Notification(user_id=u.id, activity_id=activity_id, type=event_type, text=text)
        db.add(note)
    db.commit()
    for u in users:
        await notification_hub.push(
            u.id,
            {"type": event_type, "text": text, "activity_id": activity_id, "created_at": datetime.utcnow().isoformat()},
        )


def _send_create_email(db: Session, text: str) -> None:
    settings_map = {x.key: x.value for x in db.query(SystemSetting).filter(SystemSetting.key.in_(["email_enabled", "email_recipients"])).all()}
    send_new_activity_email(
        enabled=settings_map.get("email_enabled", "false").lower() == "true",
        recipients=[x.strip() for x in settings_map.get("email_recipients", "").split(",") if x.strip()],
        text=text,
    )


@router.post("")
async def create_activity(payload: ActivityCreate, db: Session = Depends(get_db), user: User = Depends(require_editor)):
    normalized_address = normalize_address(payload.address, payload.location)
    activity = Activity(
        created_by_user_id=user.id,
        date=payload.date,
        activity_type=payload.activity_type.strip(),
        customer_name=payload.customer_name.strip(),
        location=normalize_location(payload.location, normalized_address),
        address=normalized_address,
        status="pending",
        priority=payload.priority,
        report_text=payload.report_text,
        device_info=payload.device_info,
        extra_fields_json=json.dumps(payload.extra_fields, ensure_ascii=False),
    )
    db.add(activity)
    db.flush()
    _set_assignments(db, activity, payload.assigned_staff_ids, user.id)

    after = _activity_snapshot(activity)
    add_audit_log(db, user=user, action="create", entity="activity", entity_id=str(activity.id), details={"after": after, "changed_fields": list(after.keys())})

    db.commit()
    db.refresh(activity)
    sync_activity(db, activity.id)

    message = f"{user.username} created activity #{activity.id} ({activity.customer_name})"
    await _notify_all_users(db, message, activity.id, "activity_created")
    _send_create_email(db, message)

    fresh = (
        db.query(Activity)
        .options(joinedload(Activity.assignments).joinedload(ActivityAssignment.staff))
        .filter(Activity.id == activity.id)
        .first()
    )
    return ok(_activity_to_dict(fresh))


@router.get("")
def list_activities(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    search: str | None = None,
    status: str | None = None,
    staff_id: int | None = None,
    customer: str | None = None,
    location: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
):
    q = db.query(Activity).options(joinedload(Activity.assignments).joinedload(ActivityAssignment.staff))
    filters = []
    if search:
        query = search.strip()
        s = f"%{query}%"
        normalized = normalize_text(query)
        use_normalized = normalized != query.replace(" ", "").lower()

        base_search = or_(
            Activity.customer_name.ilike(s),
            Activity.address.ilike(s),
            Activity.location.ilike(s),
            Activity.report_text.ilike(s),
            Activity.activity_type.ilike(s),
        )
        if use_normalized and len(normalized) >= 2:
            normalized_like = f"%{normalized}%"
            normalized_search = or_(
                normalize_sql_expr(Activity.customer_name).like(normalized_like),
                normalize_sql_expr(Activity.address).like(normalized_like),
                normalize_sql_expr(Activity.location).like(normalized_like),
            )
            filters.append(or_(base_search, normalized_search))
        else:
            filters.append(base_search)
    if status in {"pending", "done"}:
        filters.append(Activity.status == status)
    if customer:
        filters.append(Activity.customer_name.ilike(f"%{customer}%"))
    if location:
        like = f"%{location}%"
        filters.append(or_(Activity.address.ilike(like), Activity.location.ilike(like)))
    try:
        if date_from:
            filters.append(Activity.date >= date.fromisoformat(date_from))
        if date_to:
            filters.append(Activity.date <= date.fromisoformat(date_to))
    except ValueError as exc:
        raise fail("BAD_REQUEST", "فرمت تاریخ درست نیست", status_code=400) from exc
    if staff_id:
        q = q.join(ActivityAssignment, ActivityAssignment.activity_id == Activity.id)
        filters.append(and_(ActivityAssignment.staff_id == staff_id, ActivityAssignment.is_current.is_(True)))
    if filters:
        q = q.filter(*filters)
    total = q.with_entities(func.count(Activity.id)).scalar()
    rows = (
        q.order_by(case((Activity.status == "pending", 0), else_=1), desc(Activity.priority), desc(Activity.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return ok({"items": [_activity_to_dict(r) for r in rows], "page": page, "page_size": page_size, "total": total})


@router.get("/{activity_id}")
def get_activity(activity_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = (
        db.query(Activity)
        .options(joinedload(Activity.assignments).joinedload(ActivityAssignment.staff))
        .filter(Activity.id == activity_id)
        .first()
    )
    if not row:
        raise fail("NOT_FOUND", "فعالیت یافت نشد", status_code=404)
    return ok(_activity_to_dict(row))


@router.put("/{activity_id}")
async def update_activity(activity_id: int, payload: ActivityUpdate, db: Session = Depends(get_db), user: User = Depends(require_editor)):
    row = db.query(Activity).filter(Activity.id == activity_id).first()
    if not row:
        raise fail("NOT_FOUND", "فعالیت یافت نشد", status_code=404)

    before = _activity_snapshot(row)

    if payload.status and payload.status != row.status and normalize_role(user.role) not in {"admin", "manager"}:
        raise fail("FORBIDDEN", "تغییر وضعیت فقط توسط ادمین یا مدیر ممکن است", status_code=403)
    if payload.date is not None:
        row.date = payload.date
    if payload.activity_type is not None:
        row.activity_type = payload.activity_type
    if payload.customer_name is not None:
        row.customer_name = payload.customer_name
    if payload.location is not None or payload.address is not None:
        location_input = payload.location if payload.location is not None else row.location
        address_input = payload.address if payload.address is not None else row.address
        normalized_address = normalize_address(address_input, location_input)
        row.address = normalized_address
        row.location = normalize_location(location_input, normalized_address)
    if payload.report_text is not None:
        row.report_text = payload.report_text
    if payload.device_info is not None:
        row.device_info = payload.device_info
    if payload.extra_fields is not None:
        row.extra_fields_json = json.dumps(payload.extra_fields, ensure_ascii=False)
    if payload.priority is not None:
        row.priority = payload.priority
    if payload.status in {"pending", "done"}:
        row.status = payload.status
        if payload.status == "done":
            row.done_at = datetime.utcnow()
            row.done_by_user_id = user.id
        else:
            row.done_at = None
            row.done_by_user_id = None
    if payload.assigned_staff_ids is not None:
        _set_assignments(db, row, payload.assigned_staff_ids, user.id)

    after = _activity_snapshot(row)
    add_audit_log(
        db,
        user=user,
        action="update",
        entity="activity",
        entity_id=str(row.id),
        details={"before": before, "after": after, "changed_fields": _changed_fields(before, after)},
    )

    db.commit()
    sync_activity(db, row.id)
    await _notify_all_users(db, f"{user.username} updated activity #{row.id}", row.id, "activity_updated")

    fresh = (
        db.query(Activity)
        .options(joinedload(Activity.assignments).joinedload(ActivityAssignment.staff))
        .filter(Activity.id == activity_id)
        .first()
    )
    return ok(_activity_to_dict(fresh))


@router.delete("/{activity_id}")
async def delete_activity(activity_id: int, db: Session = Depends(get_db), user: User = Depends(require_manager_or_admin)):
    row = db.query(Activity).filter(Activity.id == activity_id).first()
    if not row:
        raise fail("NOT_FOUND", "فعالیت یافت نشد", status_code=404)
    before = _activity_snapshot(row)
    db.delete(row)
    add_audit_log(db, user=user, action="delete", entity="activity", entity_id=str(activity_id), details={"before": before})
    db.commit()
    await _notify_all_users(db, f"{user.username} deleted activity #{activity_id}", activity_id, "activity_deleted")
    return ok({"deleted_id": activity_id})


@router.post("/{activity_id}/mark-done")
async def mark_done(activity_id: int, db: Session = Depends(get_db), user: User = Depends(require_manager_or_admin)):
    row = db.query(Activity).filter(Activity.id == activity_id).first()
    if not row:
        raise fail("NOT_FOUND", "فعالیت یافت نشد", status_code=404)
    before = _activity_snapshot(row)
    row.status = "done"
    row.done_at = datetime.utcnow()
    row.done_by_user_id = user.id
    after = _activity_snapshot(row)
    add_audit_log(db, user=user, action="mark_done", entity="activity", entity_id=str(activity_id), details={"before": before, "after": after})
    db.commit()
    sync_activity(db, row.id)
    await _notify_all_users(db, f"{user.username} marked activity #{activity_id} done", activity_id, "activity_done")
    return ok({"id": row.id, "status": "done"})


@router.post("/{activity_id}/reorder")
async def reorder_activity(activity_id: int, payload: dict, db: Session = Depends(get_db), user: User = Depends(require_manager_or_admin)):
    priority = int(payload.get("priority", 0))
    row = db.query(Activity).filter(Activity.id == activity_id).first()
    if not row:
        raise fail("NOT_FOUND", "فعالیت یافت نشد", status_code=404)
    before = _activity_snapshot(row)
    row.priority = priority
    after = _activity_snapshot(row)
    add_audit_log(db, user=user, action="reorder", entity="activity", entity_id=str(activity_id), details={"before": before, "after": after})
    db.commit()
    await _notify_all_users(db, f"{user.username} changed priority for activity #{activity_id} to {priority}", activity_id, "activity_reordered")
    return ok({"id": row.id, "priority": row.priority})


@router.post("/bulk")
async def bulk_activity_action(payload: dict, db: Session = Depends(get_db), user: User = Depends(require_manager_or_admin)):
    action = str(payload.get("action") or "").strip()
    ids = payload.get("ids") or []
    if action not in {"set_status", "assign_staff", "set_priority", "delete"}:
        raise fail("BAD_REQUEST", "bulk action معتبر نیست", status_code=400)
    if not isinstance(ids, list) or not ids:
        raise fail("BAD_REQUEST", "ids ضروری است", status_code=400)
    activity_ids = [int(x) for x in ids if str(x).isdigit()]
    if not activity_ids:
        raise fail("BAD_REQUEST", "ids معتبر نیست", status_code=400)

    rows = db.query(Activity).filter(Activity.id.in_(activity_ids)).all()
    if not rows:
        raise fail("NOT_FOUND", "فعالیتی پیدا نشد", status_code=404)

    updated = 0
    deleted = 0
    touched_ids: list[int] = []
    for row in rows:
        before = _activity_snapshot(row)
        if action == "set_status":
            status_value = str(payload.get("status") or "").strip()
            if status_value not in {"pending", "done"}:
                raise fail("BAD_REQUEST", "status معتبر نیست", status_code=400)
            row.status = status_value
            if status_value == "done":
                row.done_at = datetime.utcnow()
                row.done_by_user_id = user.id
            else:
                row.done_at = None
                row.done_by_user_id = None
            updated += 1
            touched_ids.append(row.id)
        elif action == "assign_staff":
            staff_ids = payload.get("staff_ids") or []
            if not isinstance(staff_ids, list):
                raise fail("BAD_REQUEST", "staff_ids باید list باشد", status_code=400)
            _set_assignments(db, row, [int(x) for x in staff_ids if str(x).isdigit()], user.id)
            updated += 1
            touched_ids.append(row.id)
        elif action == "set_priority":
            priority = int(payload.get("priority", 0))
            row.priority = priority
            updated += 1
            touched_ids.append(row.id)
        elif action == "delete":
            db.delete(row)
            deleted += 1

        after = _activity_snapshot(row) if action != "delete" else {}
        add_audit_log(
            db,
            user=user,
            action=f"bulk_{action}",
            entity="activity",
            entity_id=str(row.id),
            details={"before": before, "after": after, "action": action},
        )

    db.commit()
    for act_id in touched_ids:
        sync_activity(db, act_id)
    await _notify_all_users(db, f"{user.username} ran bulk action '{action}' on {len(rows)} activities", None, "activity_bulk")
    return ok({"action": action, "total": len(rows), "updated": updated, "deleted": deleted, "touched_ids": touched_ids})
