import uuid

import pytest
from fastapi.testclient import TestClient

from backend.app.auth import hash_password
from backend.app.database import SessionLocal
from backend.app.main import app
from backend.app.models import Activity, User

TOKEN_CACHE: dict[str, str] = {}


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


def auth_headers(client: TestClient, username: str, password: str) -> dict[str, str]:
    if username in TOKEN_CACHE:
        return {"Authorization": f"Bearer {TOKEN_CACHE[username]}"}
    res = client.post("/api/auth/login", json={"username": username, "password": password})
    assert res.status_code == 200, res.text
    token = res.json()["data"]["access_token"]
    TOKEN_CACHE[username] = token
    return {"Authorization": f"Bearer {token}"}


def ensure_user(username: str, password: str, role: str) -> None:
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == username).first()
        if existing:
            existing.password_hash = hash_password(password)
            existing.role = role
        else:
            db.add(User(username=username, password_hash=hash_password(password), role=role))
        db.commit()
    finally:
        db.close()


def test_login_me_returns_normalized_role(client: TestClient):
    headers = auth_headers(client, "user1", "User@12345")
    res = client.get("/api/auth/me", headers=headers)
    assert res.status_code == 200
    payload = res.json()["data"]
    assert payload["role"] == "staff"


def test_viewer_cannot_create_activity(client: TestClient):
    username = f"viewer_{uuid.uuid4().hex[:8]}"
    password = "Viewer@12345"
    ensure_user(username=username, password=password, role="viewer")

    headers = auth_headers(client, username, password)
    res = client.post(
        "/api/activities",
        json={
            "date": "2026-02-24",
            "activity_type": "نصب",
            "customer_name": "Viewer Block",
            "address": "Test Address",
            "location": None,
            "report_text": None,
            "device_info": None,
            "extra_fields": {},
            "assigned_staff_ids": [],
            "priority": 1,
        },
        headers=headers,
    )
    assert res.status_code == 403


def test_excel_validate_and_import(client: TestClient):
    from io import BytesIO

    from openpyxl import Workbook

    headers = auth_headers(client, "admin", "Admin@12345")
    customer = f"Import Customer {uuid.uuid4().hex[:6]}"

    wb = Workbook()
    ws = wb.active
    ws.append(["ID", "تاریخ", "نوع فعالیت", "نام مشتری", "آدرس", "شخص موظف", "وضعیت", "دستگاه", "گزارش", "سایر"])
    ws.append(["", "2026-02-24", "بررسی شبکه", customer, "کابل", "", "pending", "", "", "{}"])

    bio = BytesIO()
    wb.save(bio)
    payload = bio.getvalue()

    validate_res = client.post(
        "/api/exports/excel/validate",
        files={
            "file": (
                "import.xlsx",
                payload,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
        headers=headers,
    )
    assert validate_res.status_code == 200, validate_res.text
    validate_data = validate_res.json()["data"]
    assert validate_data["valid"] is True
    assert validate_data["valid_rows"] == 1

    import_res = client.post(
        "/api/exports/excel/import?mode=insert",
        files={
            "file": (
                "import.xlsx",
                payload,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
        headers=headers,
    )
    assert import_res.status_code == 200, import_res.text
    import_data = import_res.json()["data"]
    assert import_data["imported"] == 1
    assert import_data["created"] == 1

    list_res = client.get(f"/api/activities?search={customer}", headers=headers)
    assert list_res.status_code == 200
    assert list_res.json()["data"]["total"] >= 1


def test_report_preset_crud(client: TestClient):
    headers = auth_headers(client, "admin", "Admin@12345")
    create_res = client.post(
        "/api/dashboard/presets",
        json={"name": "Preset Test", "filters": {"status": "pending", "location": "کابل"}, "is_shared": True},
        headers=headers,
    )
    assert create_res.status_code == 200, create_res.text
    preset = create_res.json()["data"]
    assert preset["name"] == "Preset Test"

    list_res = client.get("/api/dashboard/presets", headers=headers)
    assert list_res.status_code == 200
    assert any(x["id"] == preset["id"] for x in list_res.json()["data"])

    del_res = client.delete(f"/api/dashboard/presets/{preset['id']}", headers=headers)
    assert del_res.status_code == 200


def test_notification_rules_run(client: TestClient):
    from datetime import date, timedelta

    headers = auth_headers(client, "admin", "Admin@12345")
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == "admin").first()
        assert admin is not None
        row = Activity(
            created_by_user_id=admin.id,
            date=date.today() - timedelta(days=2),
            activity_type="ترمیم",
            customer_name=f"Rule Customer {uuid.uuid4().hex[:6]}",
            location="کابل",
            address="کابل",
            status="pending",
            priority=99,
            report_text=None,
            device_info=None,
            extra_fields_json="{}",
        )
        db.add(row)
        db.commit()
    finally:
        db.close()

    run_res = client.post("/api/notifications/rules/run", headers=headers)
    assert run_res.status_code == 200, run_res.text
    assert run_res.json()["data"]["created"] >= 1


def test_dashboard_trends(client: TestClient):
    headers = auth_headers(client, "admin", "Admin@12345")
    res = client.get("/api/dashboard/trends?days=30", headers=headers)
    assert res.status_code == 200
    payload = res.json()["data"]
    assert payload["days"] == 30
    assert isinstance(payload["items"], list)
    assert len(payload["items"]) == 30


def test_bulk_actions(client: TestClient):
    headers = auth_headers(client, "admin", "Admin@12345")
    create_res = client.post(
        "/api/activities",
        json={
            "date": "2026-02-24",
            "activity_type": "نصب",
            "customer_name": f"Bulk Customer {uuid.uuid4().hex[:6]}",
            "address": "Test Bulk Address",
            "location": None,
            "report_text": None,
            "device_info": None,
            "extra_fields": {},
            "assigned_staff_ids": [],
            "priority": 1,
        },
        headers=headers,
    )
    assert create_res.status_code == 200, create_res.text
    activity_id = create_res.json()["data"]["id"]

    bulk_res = client.post("/api/activities/bulk", json={"action": "set_priority", "ids": [activity_id], "priority": 9}, headers=headers)
    assert bulk_res.status_code == 200, bulk_res.text
    assert bulk_res.json()["data"]["updated"] >= 1

    get_res = client.get(f"/api/activities/{activity_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["data"]["priority"] == 9


def test_backup_endpoints(client: TestClient):
    headers = auth_headers(client, "admin", "Admin@12345")
    create_res = client.post("/api/system/backups", headers=headers)
    assert create_res.status_code == 200, create_res.text
    list_res = client.get("/api/system/backups", headers=headers)
    assert list_res.status_code == 200
    rows = list_res.json()["data"]
    assert isinstance(rows, list)
    assert len(rows) >= 1
