from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..api_utils import fail, ok
from ..database import get_db
from ..deps import get_current_user, require_admin
from ..models import MasterData, SystemSetting, User
from ..schemas import MasterDataIn, SettingIn
from ..services.audit_service import add_audit_log

router = APIRouter(prefix="/api/master-data", tags=["master-data"])


@router.get("")
def list_master_data(category: str | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(MasterData)
    if category:
        q = q.filter(MasterData.category == category)
    rows = q.order_by(MasterData.category.asc(), MasterData.value.asc()).all()
    return ok([{"id": x.id, "category": x.category, "value": x.value, "active": x.active} for x in rows])


@router.post("")
def create_master_data(payload: MasterDataIn, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    exists = db.query(MasterData).filter(MasterData.category == payload.category, MasterData.value == payload.value).first()
    if exists:
        raise fail("CONFLICT", "مقدار از قبل موجود است", status_code=409)
    row = MasterData(category=payload.category, value=payload.value, active=payload.active)
    db.add(row)
    add_audit_log(db, user=user, action="create", entity="master_data", entity_id="new", details=payload.model_dump())
    db.commit()
    db.refresh(row)
    return ok({"id": row.id, "category": row.category, "value": row.value, "active": row.active})


@router.put("/{item_id}")
def update_master_data(item_id: int, payload: MasterDataIn, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    row = db.query(MasterData).filter(MasterData.id == item_id).first()
    if not row:
        raise fail("NOT_FOUND", "موجود نیست", status_code=404)
    row.category = payload.category
    row.value = payload.value
    row.active = payload.active
    add_audit_log(db, user=user, action="update", entity="master_data", entity_id=str(item_id), details=payload.model_dump())
    db.commit()
    return ok({"id": row.id, "category": row.category, "value": row.value, "active": row.active})


@router.delete("/{item_id}")
def delete_master_data(item_id: int, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    row = db.query(MasterData).filter(MasterData.id == item_id).first()
    if not row:
        raise fail("NOT_FOUND", "موجود نیست", status_code=404)
    db.delete(row)
    add_audit_log(db, user=user, action="delete", entity="master_data", entity_id=str(item_id))
    db.commit()
    return ok({"deleted_id": item_id})


@router.get("/settings/system")
def list_settings(db: Session = Depends(get_db), user: User = Depends(require_admin)):
    rows = db.query(SystemSetting).all()
    return ok([{"key": x.key, "value": x.value} for x in rows])


@router.post("/settings/system")
def upsert_setting(payload: SettingIn, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    row = db.query(SystemSetting).filter(SystemSetting.key == payload.key).first()
    if row:
        row.value = payload.value
    else:
        row = SystemSetting(key=payload.key, value=payload.value)
        db.add(row)
    add_audit_log(db, user=user, action="upsert", entity="setting", entity_id=payload.key, details=payload.model_dump())
    db.commit()
    return ok({"key": payload.key, "value": payload.value})
