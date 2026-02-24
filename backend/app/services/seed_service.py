import json
from datetime import date, timedelta

from sqlalchemy.orm import Session

from ..auth import hash_password
from ..config import settings
from ..models import Activity, ActivityAssignment, MasterData, Staff, User


def seed_defaults(db: Session) -> None:
    admin = db.query(User).filter(User.username == settings.default_admin_username).first()
    if not admin:
        admin = User(
            username=settings.default_admin_username,
            password_hash=hash_password(settings.default_admin_password),
            role="admin",
        )
        db.add(admin)

    user = db.query(User).filter(User.username == "user1").first()
    if not user:
        user = User(username="user1", password_hash=hash_password("User@12345"), role="user")
        db.add(user)
    db.commit()

    staff_data = [
        ("احمد نوری", "070000001"),
        ("سعید رحمانی", "070000002"),
        ("فرید هاشمی", "070000003"),
        ("جاوید حقمل", "070000004"),
    ]
    for name, phone in staff_data:
        if not db.query(Staff).filter(Staff.name == name).first():
            db.add(Staff(name=name, phone=phone, active=True))

    master_defaults = {
        "activity_type": ["نصب", "ترمیم", "بررسی شبکه", "تعویض دستگاه"],
        "device_type": ["روتر", "مودم", "سوئیچ", "آنتن"],
        "location": ["کابل", "هرات", "بلخ", "ننگرهار"],
    }
    for category, values in master_defaults.items():
        for value in values:
            exists = db.query(MasterData).filter(MasterData.category == category, MasterData.value == value).first()
            if not exists:
                db.add(MasterData(category=category, value=value, active=True))
    db.commit()

    if db.query(Activity).count() >= 10:
        return

    staffs = db.query(Staff).all()
    creator = db.query(User).filter(User.username == "user1").first()
    today = date.today()
    rows = [
        ("نصب", "شرکت امید", "کابل", "مکروریان", "روتر MikroTik", "نصب انجام نشد", "pending"),
        ("ترمیم", "فروشگاه بهار", "هرات", "شهر نو", "مودم Huawei", "کابل آسیب دیده", "pending"),
        ("بررسی شبکه", "مکتب معرفت", "کابل", "کارته نو", "سوئیچ TP-Link", "کندی شبکه", "done"),
        ("تعویض دستگاه", "کلینیک صحت", "بلخ", "مرکز شهر", "روتر Cisco", "دستگاه فرسوده", "pending"),
        ("ترمیم", "دفتر ارسال", "ننگرهار", "محله اول", "مودم ZTE", "چراغ WAN خاموش", "done"),
        ("نصب", "هوتل آریانا", "کابل", "دارالامان", "آنتن بیرونی", "نیاز به پایه جدید", "pending"),
        ("بررسی شبکه", "شرکت تیزنت", "هرات", "غازی آباد", "روتر MikroTik", "قطعی متناوب", "pending"),
        ("ترمیم", "موسسه دانا", "بلخ", "چهارراهی", "سوئیچ D-Link", "پورت 3 خراب", "done"),
        ("نصب", "منزل رحیمی", "کابل", "خیرخانه", "مودم FiberHome", "نصب اولیه", "pending"),
        ("بررسی شبکه", "مارکیت مرکزی", "هرات", "جاده ولایت", "روتر TP-Link", "افت سرعت شدید", "pending"),
    ]

    for idx, row in enumerate(rows):
        activity = Activity(
            created_by_user_id=creator.id,
            date=today - timedelta(days=idx % 5),
            activity_type=row[0],
            customer_name=row[1],
            location=row[2],
            address=row[3],
            device_info=row[4],
            report_text=row[5],
            status=row[6],
            priority=idx,
            done_by_user_id=admin.id if row[6] == "done" else None,
            done_at=None,
            extra_fields_json=json.dumps({"شدت": "متوسط", "منبع": "سیستم"}, ensure_ascii=False),
        )
        db.add(activity)
        db.flush()
        assigned_staff = staffs[idx % len(staffs)]
        db.add(
            ActivityAssignment(
                activity_id=activity.id,
                staff_id=assigned_staff.id,
                assigned_by_user_id=creator.id,
                is_current=True,
            )
        )
    db.commit()
