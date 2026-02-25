from collections import defaultdict, deque
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ..api_utils import fail, ok
from ..auth import create_access_token, create_refresh_token, decode_token, hash_password, verify_password
from ..database import get_db
from ..deps import get_current_user, normalize_role
from ..models import User
from ..schemas import ChangePasswordRequest, LoginRequest
from ..services.audit_service import add_audit_log

router = APIRouter(prefix="/api/auth", tags=["auth"])

LOGIN_WINDOW_SECONDS = 300
MAX_ATTEMPTS = 5
login_attempts: dict[str, deque] = defaultdict(deque)


def _enforce_login_rate_limit(ip: str) -> None:
    now = datetime.utcnow()
    bucket = login_attempts[ip]
    while bucket and (now - bucket[0]).total_seconds() > LOGIN_WINDOW_SECONDS:
        bucket.popleft()
    if len(bucket) >= MAX_ATTEMPTS:
        raise fail("RATE_LIMIT", "تلاش زیاد برای ورود. بعدا دوباره کوشش کنید.", status_code=429)
    bucket.append(now)


@router.post("/login")
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    ip = request.client.host if request.client else "unknown"
    _enforce_login_rate_limit(ip)

    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise fail("INVALID_CREDENTIALS", "نام کاربری یا رمز عبور اشتباه است", status_code=401)

    normalized_role = normalize_role(user.role)
    access = create_access_token(user.username, normalized_role)
    refresh = create_refresh_token(user.username)
    add_audit_log(db, user=user, action="login", entity="user", entity_id=str(user.id), details={"ip": ip})
    db.commit()
    return ok(
        {
            "access_token": access,
            "refresh_token": refresh,
            "token_type": "bearer",
            "role": normalized_role,
            "username": user.username,
        }
    )


@router.post("/refresh")
def refresh_token(payload: dict, db: Session = Depends(get_db)):
    token = payload.get("refresh_token")
    if not token:
        raise fail("BAD_REQUEST", "refresh_token نیاز است", status_code=400)
    try:
        data = decode_token(token)
        if data.get("type") != "refresh":
            raise ValueError("bad type")
    except Exception as exc:
        raise fail("INVALID_TOKEN", "توکن معتبر نیست", status_code=401) from exc
    username = data.get("sub")
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise fail("INVALID_TOKEN", "کاربر یافت نشد", status_code=401)
    return ok({"access_token": create_access_token(user.username, normalize_role(user.role))})


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return ok({"id": user.id, "username": user.username, "role": normalize_role(user.role)})


@router.post("/change-password")
def change_password(payload: ChangePasswordRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not verify_password(payload.current_password, user.password_hash):
        raise fail("INVALID_CREDENTIALS", "رمز فعلی اشتباه است", status_code=400)
    if payload.current_password == payload.new_password:
        raise fail("BAD_REQUEST", "رمز جدید باید متفاوت باشد", status_code=400)

    user.password_hash = hash_password(payload.new_password)
    add_audit_log(db, user=user, action="change_password", entity="user", entity_id=str(user.id), details={})
    db.commit()
    return ok({"changed": True})
