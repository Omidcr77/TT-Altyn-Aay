from datetime import date as dt_date
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ErrorPayload(BaseModel):
    code: str
    message: str
    details: Any | None = None


class ApiResponse(BaseModel):
    success: bool = True
    data: Any | None = None
    error: ErrorPayload | None = None


class LoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=80)
    password: str = Field(min_length=6, max_length=120)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str
    username: str


class UserOut(BaseModel):
    id: int
    username: str
    role: str

    model_config = ConfigDict(from_attributes=True)


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=80)
    password: str = Field(min_length=6, max_length=120)
    role: str = Field(default="staff")


class UserUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=80)
    password: str | None = Field(default=None, min_length=6, max_length=120)
    role: str | None = None


class StaffBase(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    phone: str | None = Field(default=None, max_length=50)
    active: bool = True


class StaffCreate(StaffBase):
    pass


class StaffUpdate(StaffBase):
    pass


class StaffOut(StaffBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ActivityBase(BaseModel):
    date: dt_date
    activity_type: str = Field(min_length=2, max_length=120)
    customer_name: str = Field(min_length=2, max_length=120)
    location: str | None = Field(default=None, max_length=120)
    address: str | None = Field(default=None, max_length=255)
    report_text: str | None = None
    device_info: str | None = Field(default=None, max_length=255)
    extra_fields: dict[str, Any] = Field(default_factory=dict)
    assigned_staff_ids: list[int] = Field(default_factory=list)
    priority: int = 0

    @field_validator("priority")
    @classmethod
    def valid_priority(cls, value: int) -> int:
        if value < 0 or value > 1000:
            raise ValueError("priority out of range")
        return value


class ActivityCreate(ActivityBase):
    pass


class ActivityUpdate(BaseModel):
    date: dt_date | None = None
    activity_type: str | None = Field(default=None, min_length=2, max_length=120)
    customer_name: str | None = Field(default=None, min_length=2, max_length=120)
    location: str | None = Field(default=None, max_length=120)
    address: str | None = Field(default=None, max_length=255)
    report_text: str | None = None
    device_info: str | None = Field(default=None, max_length=255)
    extra_fields: dict[str, Any] | None = None
    assigned_staff_ids: list[int] | None = None
    priority: int | None = None
    status: str | None = None


class ActivityOut(BaseModel):
    id: int
    created_at: datetime
    updated_at: datetime | None
    created_by_user_id: int
    done_by_user_id: int | None
    done_at: datetime | None
    date: dt_date
    activity_type: str
    customer_name: str
    location: str | None
    address: str | None
    status: str
    priority: int
    report_text: str | None
    device_info: str | None
    extra_fields: dict[str, Any]
    assigned_staff: list[StaffOut]


class NotificationOut(BaseModel):
    id: int
    activity_id: int | None
    type: str
    text: str
    read_at: datetime | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MasterDataIn(BaseModel):
    category: str = Field(min_length=2, max_length=50)
    value: str = Field(min_length=1, max_length=120)
    active: bool = True


class MasterDataOut(MasterDataIn):
    id: int

    model_config = ConfigDict(from_attributes=True)


class SettingIn(BaseModel):
    key: str = Field(min_length=2, max_length=100)
    value: str = Field(min_length=0, max_length=4000)


class AuditOut(BaseModel):
    id: int
    user_id: int | None
    action: str
    entity: str
    entity_id: str
    detail_json: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
