from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..api_utils import fail, ok
from ..auth import hash_password
from ..database import get_db
from ..deps import normalize_role, require_admin
from ..models import User
from ..schemas import UserCreate, UserUpdate
from ..services.audit_service import add_audit_log

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("")
def list_users(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    rows = db.query(User).order_by(User.created_at.desc()).all()
    return ok(
        [
            {
                "id": x.id,
                "username": x.username,
                "role": normalize_role(x.role),
                "created_at": x.created_at.isoformat(),
            }
            for x in rows
        ]
    )


@router.post("")
def create_user(payload: UserCreate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    username = payload.username.strip()
    if db.query(User).filter(User.username == username).first():
        raise fail("DUPLICATE", "نام کاربری تکراری است", status_code=400)

    row = User(username=username, password_hash=hash_password(payload.password), role=normalize_role(payload.role))
    db.add(row)
    add_audit_log(db, user=admin, action="create", entity="user", entity_id="new", details={"username": username, "role": row.role})
    db.commit()
    db.refresh(row)
    return ok({"id": row.id, "username": row.username, "role": normalize_role(row.role), "created_at": row.created_at.isoformat()})


@router.put("/{user_id}")
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    row = db.query(User).filter(User.id == user_id).first()
    if not row:
        raise fail("NOT_FOUND", "کاربر پیدا نشد", status_code=404)

    if payload.username is not None:
        username = payload.username.strip()
        if username != row.username and db.query(User).filter(User.username == username).first():
            raise fail("DUPLICATE", "نام کاربری تکراری است", status_code=400)
        row.username = username

    if payload.role is not None:
        next_role = normalize_role(payload.role)
        if row.id == admin.id and next_role != "admin":
            raise fail("FORBIDDEN", "ادمین جاری نمی تواند نقش خود را کاهش دهد", status_code=400)
        row.role = next_role

    if payload.password is not None and payload.password.strip():
        row.password_hash = hash_password(payload.password)

    add_audit_log(db, user=admin, action="update", entity="user", entity_id=str(row.id), details={"username": row.username, "role": normalize_role(row.role)})
    db.commit()
    return ok({"id": row.id, "username": row.username, "role": normalize_role(row.role), "created_at": row.created_at.isoformat()})


@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    row = db.query(User).filter(User.id == user_id).first()
    if not row:
        raise fail("NOT_FOUND", "کاربر پیدا نشد", status_code=404)
    if row.id == admin.id:
        raise fail("FORBIDDEN", "نمی توانید حساب خودتان را حذف کنید", status_code=400)

    if normalize_role(row.role) == "admin":
        admins = db.query(User).all()
        admin_count = sum(1 for u in admins if normalize_role(u.role) == "admin")
        if admin_count <= 1:
            raise fail("FORBIDDEN", "حداقل یک ادمین باید باقی بماند", status_code=400)

    db.delete(row)
    add_audit_log(db, user=admin, action="delete", entity="user", entity_id=str(user_id), details={"username": row.username})
    db.commit()
    return ok({"deleted_id": user_id})
