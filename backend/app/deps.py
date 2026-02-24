from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .auth import decode_token
from .database import get_db
from .models import User

bearer = HTTPBearer(auto_error=True)

ROLE_ADMIN = "admin"
ROLE_MANAGER = "manager"
ROLE_STAFF = "staff"
ROLE_VIEWER = "viewer"
ROLE_LEGACY_USER = "user"


def normalize_role(role: str | None) -> str:
    normalized = (role or "").strip().lower()
    if normalized == ROLE_LEGACY_USER:
        return ROLE_STAFF
    if normalized in {ROLE_ADMIN, ROLE_MANAGER, ROLE_STAFF, ROLE_VIEWER}:
        return normalized
    return ROLE_VIEWER


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise ValueError("invalid token type")
        username = payload.get("sub")
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="توکن معتبر نیست") from exc

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="کاربر پیدا نشد")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if normalize_role(user.role) != ROLE_ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="فقط ادمین دسترسی دارد")
    return user


def require_roles(*allowed_roles: str):
    normalized_allowed = {normalize_role(x) for x in allowed_roles}

    def _guard(user: User = Depends(get_current_user)) -> User:
        if normalize_role(user.role) not in normalized_allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="شما اجازه دسترسی ندارید")
        return user

    return _guard


require_manager_or_admin = require_roles(ROLE_ADMIN, ROLE_MANAGER)
require_editor = require_roles(ROLE_ADMIN, ROLE_MANAGER, ROLE_STAFF, ROLE_LEGACY_USER)
