import json
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..api_utils import fail, loads_json, ok
from ..database import get_db
from ..deps import get_current_user, normalize_role
from ..models import Activity, ActivityAssignment, ReportPreset, Staff, User

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
def stats(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    today = date.today()
    week_start = today - timedelta(days=today.weekday())

    total_today = db.query(func.count(Activity.id)).filter(Activity.date == today).scalar()
    total_week = db.query(func.count(Activity.id)).filter(Activity.date >= week_start).scalar()
    pending = db.query(func.count(Activity.id)).filter(Activity.status == "pending").scalar()
    done = db.query(func.count(Activity.id)).filter(Activity.status == "done").scalar()

    by_type_rows = (
        db.query(Activity.activity_type, func.count(Activity.id))
        .group_by(Activity.activity_type)
        .order_by(func.count(Activity.id).desc())
        .all()
    )
    by_staff_rows = (
        db.query(Staff.name, func.count(ActivityAssignment.id))
        .join(ActivityAssignment, ActivityAssignment.staff_id == Staff.id)
        .filter(ActivityAssignment.is_current.is_(True))
        .group_by(Staff.name)
        .all()
    )
    recent = db.query(Activity).order_by(Activity.created_at.desc()).limit(5).all()
    return ok(
        {
            "total_today": total_today,
            "total_week": total_week,
            "pending": pending,
            "done": done,
            "by_type": [{"name": x[0], "count": x[1]} for x in by_type_rows],
            "by_staff": [{"name": x[0], "count": x[1]} for x in by_staff_rows],
            "recent": [
                {
                    "id": x.id,
                    "customer_name": x.customer_name,
                    "address": x.address,
                    "activity_type": x.activity_type,
                    "status": x.status,
                    "date": x.date.isoformat(),
                }
                for x in recent
            ],
        }
    )


@router.get("/trends")
def trends(
    days: int = 30,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    safe_days = max(7, min(days, 180))
    start = date.today() - timedelta(days=safe_days - 1)
    created_rows = (
        db.query(Activity.date, func.count(Activity.id))
        .filter(Activity.date >= start)
        .group_by(Activity.date)
        .all()
    )
    done_rows = (
        db.query(func.date(Activity.done_at), func.count(Activity.id))
        .filter(Activity.done_at.is_not(None), func.date(Activity.done_at) >= start.isoformat())
        .group_by(func.date(Activity.done_at))
        .all()
    )
    created_map = {x[0].isoformat(): int(x[1]) for x in created_rows}
    done_map = {str(x[0]): int(x[1]) for x in done_rows}

    result = []
    for i in range(safe_days):
        d = start + timedelta(days=i)
        key = d.isoformat()
        created = created_map.get(key, 0)
        done = done_map.get(key, 0)
        result.append({"date": key, "created": created, "done": done, "pending_delta": created - done})
    return ok({"days": safe_days, "items": result})


def _preset_to_dict(row: ReportPreset) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "filters": loads_json(row.filters_json),
        "is_shared": row.is_shared,
        "created_by_user_id": row.created_by_user_id,
        "created_at": row.created_at.isoformat(),
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


@router.get("/presets")
def list_presets(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (
        db.query(ReportPreset)
        .filter(or_(ReportPreset.created_by_user_id == user.id, ReportPreset.is_shared.is_(True)))
        .order_by(ReportPreset.is_shared.desc(), ReportPreset.updated_at.desc())
        .all()
    )
    return ok([_preset_to_dict(x) for x in rows])


@router.post("/presets")
def create_preset(payload: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    name = str(payload.get("name") or "").strip()
    filters = payload.get("filters") or {}
    is_shared = bool(payload.get("is_shared") or False)
    if len(name) < 2:
        raise fail("BAD_REQUEST", "نام preset ضروری است", status_code=400)
    if not isinstance(filters, dict):
        raise fail("BAD_REQUEST", "filters باید object باشد", status_code=400)
    if is_shared and normalize_role(user.role) not in {"admin", "manager"}:
        raise fail("FORBIDDEN", "اشتراک preset فقط توسط مدیر یا ادمین مجاز است", status_code=403)

    row = ReportPreset(
        name=name,
        filters_json=json.dumps(filters, ensure_ascii=False),
        is_shared=is_shared,
        created_by_user_id=user.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return ok(_preset_to_dict(row))


@router.put("/presets/{preset_id}")
def update_preset(preset_id: int, payload: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.query(ReportPreset).filter(ReportPreset.id == preset_id).first()
    if not row:
        raise fail("NOT_FOUND", "preset یافت نشد", status_code=404)
    if row.created_by_user_id != user.id and normalize_role(user.role) not in {"admin", "manager"}:
        raise fail("FORBIDDEN", "اجازه ویرایش preset را ندارید", status_code=403)

    if "name" in payload:
        name = str(payload.get("name") or "").strip()
        if len(name) < 2:
            raise fail("BAD_REQUEST", "نام preset ضروری است", status_code=400)
        row.name = name
    if "filters" in payload:
        filters = payload.get("filters")
        if not isinstance(filters, dict):
            raise fail("BAD_REQUEST", "filters باید object باشد", status_code=400)
        row.filters_json = json.dumps(filters, ensure_ascii=False)
    if "is_shared" in payload:
        is_shared = bool(payload.get("is_shared") or False)
        if is_shared and normalize_role(user.role) not in {"admin", "manager"}:
            raise fail("FORBIDDEN", "اشتراک preset فقط توسط مدیر یا ادمین مجاز است", status_code=403)
        row.is_shared = is_shared

    db.commit()
    db.refresh(row)
    return ok(_preset_to_dict(row))


@router.delete("/presets/{preset_id}")
def delete_preset(preset_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.query(ReportPreset).filter(ReportPreset.id == preset_id).first()
    if not row:
        raise fail("NOT_FOUND", "preset یافت نشد", status_code=404)
    if row.created_by_user_id != user.id and normalize_role(user.role) not in {"admin", "manager"}:
        raise fail("FORBIDDEN", "اجازه حذف preset را ندارید", status_code=403)
    db.delete(row)
    db.commit()
    return ok({"deleted_id": preset_id})
