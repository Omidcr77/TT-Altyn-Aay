import json
from datetime import datetime
from typing import Any

from fastapi import HTTPException


def ok(data: Any = None) -> dict[str, Any]:
    return {"success": True, "data": data, "error": None}


def fail(code: str, message: str, details: Any = None, status_code: int = 400) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "details": details},
    )


def loads_json(value: str | None) -> dict[str, Any]:
    if not value:
        return {}
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


def now_iso() -> str:
    return datetime.utcnow().isoformat()
