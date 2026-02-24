import asyncio
from datetime import date, datetime, time, timedelta

from sqlalchemy.orm import Session

from ..config import settings
from ..deps import normalize_role
from ..models import Activity, ActivityAssignment, Notification, SystemSetting, User
from .monitoring_service import log_event, log_exception
from .notification_service import notification_hub


def _to_int(value: str | None, default: int) -> int:
    try:
        return int(value) if value is not None else default
    except (TypeError, ValueError):
        return default


def _rule_recipients(db: Session) -> list[User]:
    rows = db.query(User).all()
    preferred = [x for x in rows if normalize_role(x.role) in {"admin", "manager"}]
    return preferred or [x for x in rows if normalize_role(x.role) == "admin"]


def _exists_today(db: Session, user_id: int, activity_id: int, note_type: str, today_start: datetime) -> bool:
    count = (
        db.query(Notification.id)
        .filter(
            Notification.user_id == user_id,
            Notification.activity_id == activity_id,
            Notification.type == note_type,
            Notification.created_at >= today_start,
        )
        .count()
    )
    return count > 0


async def run_notification_rules(db: Session, push_live: bool = True) -> dict[str, int]:
    raw_settings = {
        row.key: row.value
        for row in db.query(SystemSetting)
        .filter(
            SystemSetting.key.in_(
                [
                    "notification_rule_overdue_enabled",
                    "notification_rule_unassigned_enabled",
                    "notification_rule_high_priority_enabled",
                    "notification_high_priority_threshold",
                    "notification_overdue_days",
                ]
            )
        )
        .all()
    }
    overdue_enabled = raw_settings.get("notification_rule_overdue_enabled", "true").lower() == "true"
    unassigned_enabled = raw_settings.get("notification_rule_unassigned_enabled", "true").lower() == "true"
    high_priority_enabled = raw_settings.get("notification_rule_high_priority_enabled", "true").lower() == "true"
    overdue_days = _to_int(raw_settings.get("notification_overdue_days"), settings.notification_overdue_days)
    high_priority_threshold = _to_int(
        raw_settings.get("notification_high_priority_threshold"), settings.notification_high_priority_threshold
    )

    today = date.today()
    today_start = datetime.combine(today, time.min)
    overdue_limit = today - timedelta(days=max(overdue_days, 0))
    priority_limit = max(high_priority_threshold, 0)

    recipients = _rule_recipients(db)
    if not recipients:
        return {"created": 0}

    pending = db.query(Activity).filter(Activity.status == "pending").all()
    created_items: list[tuple[int, int, str, str]] = []

    for activity in pending:
        has_assignment = (
            db.query(ActivityAssignment.id)
            .filter(ActivityAssignment.activity_id == activity.id, ActivityAssignment.is_current.is_(True))
            .first()
            is not None
        )
        checks: list[tuple[str, bool, str]] = [
            ("rule_overdue", overdue_enabled and activity.date < overdue_limit, f"فعالیت #{activity.id} معطل است"),
            ("rule_unassigned", unassigned_enabled and not has_assignment, f"فعالیت #{activity.id} کارمند تعیین نشده دارد"),
            (
                "rule_high_priority",
                high_priority_enabled and activity.priority >= priority_limit,
                f"فعالیت #{activity.id} اولویت بالا دارد",
            ),
        ]

        for note_type, is_match, text in checks:
            if not is_match:
                continue
            for recipient in recipients:
                if _exists_today(db, recipient.id, activity.id, note_type, today_start):
                    continue
                db.add(Notification(user_id=recipient.id, activity_id=activity.id, type=note_type, text=text))
                created_items.append((recipient.id, activity.id, note_type, text))

    if not created_items:
        return {"created": 0}

    db.commit()

    if push_live:
        for user_id, activity_id, note_type, text in created_items:
            await notification_hub.push(
                user_id,
                {
                    "type": note_type,
                    "text": text,
                    "activity_id": activity_id,
                    "created_at": datetime.utcnow().isoformat(),
                },
            )

    return {"created": len(created_items)}


async def run_rule_scheduler(session_factory) -> None:
    while True:
        db = session_factory()
        try:
            summary = await run_notification_rules(db, push_live=True)
            log_event("notification_rules_tick", **summary)
        except asyncio.CancelledError:
            db.close()
            raise
        except Exception as exc:
            log_exception("notification_rules_tick_failed", exc)
        finally:
            db.close()
        await asyncio.sleep(max(settings.notification_rules_interval_seconds, 60))
