import json
import logging
import time
from typing import Any

import httpx

from ..config import settings


logger = logging.getLogger("tt_altyn_aay")


def setup_logging() -> None:
    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    logging.basicConfig(level=level, format="%(message)s")


def log_event(event: str, **fields: Any) -> None:
    payload = {"event": event, "ts": time.time(), **fields}
    logger.info(json.dumps(payload, ensure_ascii=False, default=str))


def log_exception(event: str, exc: Exception, **fields: Any) -> None:
    payload = {"event": event, "error": str(exc), **fields}
    logger.exception(json.dumps(payload, ensure_ascii=False, default=str))


async def report_exception(event: str, exc: Exception, **fields: Any) -> None:
    if not settings.error_tracking_webhook:
        return
    payload = {"event": event, "error": str(exc), "context": fields}
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            await client.post(settings.error_tracking_webhook, json=payload)
    except Exception:
        pass
