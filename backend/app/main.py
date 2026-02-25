import asyncio
import time
from uuid import uuid4

from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .api_utils import ok
from .config import settings
from .database import Base, SessionLocal, engine
from .models import Activity
from .routers import activities, audit, auth, dashboard, exports, master_data, notifications, staff, suggestions, system
from .services.address_service import backfill_activity_addresses
from .services.backup_service import apply_retention, create_backup, run_backup_scheduler
from .services.excel_service import ensure_excel_exists, sync_activity
from .services.monitoring_service import log_event, report_exception, setup_logging
from .services.notification_rules_service import run_rule_scheduler
from .services.seed_service import seed_defaults

app = FastAPI(title="TT Altyn Aay App")
rule_scheduler_task: asyncio.Task | None = None
backup_scheduler_task: asyncio.Task | None = None

setup_logging()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_hosts)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    started = time.perf_counter()
    request_id = request.headers.get("x-request-id") or uuid4().hex
    try:
        response = await call_next(request)
        took_ms = round((time.perf_counter() - started) * 1000, 2)
        response.headers["x-request-id"] = request_id
        log_event(
            "http_request",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            duration_ms=took_ms,
        )
        return response
    except Exception as exc:
        took_ms = round((time.perf_counter() - started) * 1000, 2)
        log_event(
            "http_request_failed",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            duration_ms=took_ms,
            error=str(exc),
        )
        raise


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    detail = exc.detail if isinstance(exc.detail, dict) else {"code": "HTTP_ERROR", "message": str(exc.detail), "details": None}
    return JSONResponse(status_code=exc.status_code, content={"success": False, "data": None, "error": detail})


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    await report_exception("unhandled_exception", exc, path=request.url.path, method=request.method)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "data": None,
            "error": {"code": "SERVER_ERROR", "message": "خطای داخلی سیستم", "details": str(exc)},
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    await report_exception("validation_exception", Exception("validation_error"), path=request.url.path, details=exc.errors())
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "data": None,
            "error": {"code": "VALIDATION_ERROR", "message": "ورودی معتبر نیست", "details": exc.errors()},
        },
    )


app.include_router(auth.router)
app.include_router(activities.router)
app.include_router(staff.router)
app.include_router(master_data.router)
app.include_router(notifications.router)
app.include_router(dashboard.router)
app.include_router(exports.router)
app.include_router(suggestions.router)
app.include_router(audit.router)
app.include_router(system.router)

root_dir = Path(__file__).resolve().parents[2]
frontend_dir = root_dir / "frontend"
app.mount("/frontend", StaticFiles(directory=str(frontend_dir)), name="frontend")


@app.get("/")
def home():
    return FileResponse(frontend_dir / "index.html")


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_defaults(db)
        backfill_activity_addresses(db)
        ensure_excel_exists()
        create_backup()
        apply_retention()
        ids = [x[0] for x in db.query(Activity.id).all()]
        for act_id in ids:
            sync_activity(db, act_id)
    finally:
        db.close()


@app.on_event("startup")
async def start_background_jobs():
    global rule_scheduler_task
    global backup_scheduler_task
    rule_scheduler_task = asyncio.create_task(run_rule_scheduler(SessionLocal))
    backup_scheduler_task = asyncio.create_task(run_backup_scheduler())


@app.on_event("shutdown")
async def stop_background_jobs():
    global rule_scheduler_task
    global backup_scheduler_task
    if rule_scheduler_task:
        rule_scheduler_task.cancel()
        try:
            await rule_scheduler_task
        except asyncio.CancelledError:
            pass
        rule_scheduler_task = None
    if backup_scheduler_task:
        backup_scheduler_task.cancel()
        try:
            await backup_scheduler_task
        except asyncio.CancelledError:
            pass
        backup_scheduler_task = None


@app.get("/api/health")
def health():
    return ok({"status": "ok"})
