import json
from typing import Any

from sqlalchemy.orm import Session

from ..models import AuditLog, User


def add_audit_log(
    db: Session,
    *,
    user: User | None,
    action: str,
    entity: str,
    entity_id: str,
    details: dict[str, Any] | None = None,
) -> None:
    record = AuditLog(
        user_id=user.id if user else None,
        action=action,
        entity=entity,
        entity_id=entity_id,
        detail_json=json.dumps(details or {}, ensure_ascii=False),
    )
    db.add(record)
