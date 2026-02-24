from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..api_utils import fail, ok
from ..database import get_db
from ..deps import get_current_user, require_admin
from ..models import Staff, User
from ..schemas import StaffCreate, StaffUpdate
from ..services.audit_service import add_audit_log

router = APIRouter(prefix="/api/staff", tags=["staff"])


@router.get("")
def list_staff(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(Staff).order_by(Staff.name.asc()).all()
    return ok([{"id": x.id, "name": x.name, "phone": x.phone, "active": x.active, "created_at": x.created_at.isoformat()} for x in rows])


@router.post("")
def create_staff(payload: StaffCreate, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    row = Staff(name=payload.name.strip(), phone=payload.phone, active=payload.active)
    db.add(row)
    add_audit_log(db, user=user, action="create", entity="staff", entity_id="new", details={"name": payload.name})
    db.commit()
    db.refresh(row)
    return ok({"id": row.id, "name": row.name, "phone": row.phone, "active": row.active})


@router.put("/{staff_id}")
def update_staff(staff_id: int, payload: StaffUpdate, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    row = db.query(Staff).filter(Staff.id == staff_id).first()
    if not row:
        raise fail("NOT_FOUND", "کارمند پیدا نشد", status_code=404)
    row.name = payload.name
    row.phone = payload.phone
    row.active = payload.active
    add_audit_log(db, user=user, action="update", entity="staff", entity_id=str(staff_id), details={"name": payload.name})
    db.commit()
    return ok({"id": row.id, "name": row.name, "phone": row.phone, "active": row.active})


@router.delete("/{staff_id}")
def delete_staff(staff_id: int, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    row = db.query(Staff).filter(Staff.id == staff_id).first()
    if not row:
        raise fail("NOT_FOUND", "کارمند پیدا نشد", status_code=404)
    db.delete(row)
    add_audit_log(db, user=user, action="delete", entity="staff", entity_id=str(staff_id))
    db.commit()
    return ok({"deleted_id": staff_id})
