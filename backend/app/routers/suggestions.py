from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..api_utils import ok
from ..database import get_db
from ..deps import get_current_user
from ..models import Activity, Staff, User

router = APIRouter(prefix="/api/suggestions", tags=["suggestions"])


@router.get("")
def suggestions(
    field: str = Query(pattern="^(customer_name|address|staff)$"),
    q: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    like = f"%{q.strip()}%"
    if field == "customer_name":
        rows = db.query(Activity.customer_name).filter(Activity.customer_name.ilike(like)).distinct().limit(10).all()
        return ok([x[0] for x in rows if x[0]])
    if field == "address":
        rows = db.query(Activity.address).filter(Activity.address.ilike(like)).distinct().limit(10).all()
        return ok([x[0] for x in rows if x[0]])
    rows = db.query(Staff.name).filter(Staff.name.ilike(like), Staff.active.is_(True)).limit(10).all()
    return ok([x[0] for x in rows if x[0]])
