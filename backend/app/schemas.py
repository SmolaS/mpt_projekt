from datetime import date, datetime, timezone
from typing import Annotated, Literal

from pydantic import AfterValidator, AwareDatetime, BaseModel, ConfigDict, EmailStr, Field


def _ensure_utc(v: datetime) -> datetime:
    # SQLite zwraca daty bez strefy; w bazie trzymamy zawsze UTC.
    return v if v.tzinfo else v.replace(tzinfo=timezone.utc)


UtcDatetime = Annotated[datetime, AfterValidator(_ensure_utc)]


class LoginIn(BaseModel):
    username: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ReservationCreate(BaseModel):
    restaurant_id: str = Field(default="bistro-agh", max_length=50)
    table_id: int | None = None
    guest_name: str = Field(min_length=1, max_length=100)
    guest_email: EmailStr
    guest_phone: str | None = Field(default=None, max_length=30)
    party_size: int = Field(ge=1, le=20)
    starts_at: AwareDatetime  # wymagana strefa, np. 2026-11-20T18:00:00+01:00
    notes: str | None = Field(default=None, max_length=255)
    express_live: bool = False


class ReservationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    restaurant_id: str = "bistro-agh"
    table_id: int
    table_name: str
    guest_name: str
    guest_email: str
    guest_phone: str | None
    party_size: int
    starts_at: UtcDatetime
    ends_at: UtcDatetime
    status: str
    notes: str | None = None


class ReservationCreated(ReservationOut):
    cancel_token: str


class ReservationStatusUpdate(BaseModel):
    status: Literal["confirmed", "seated", "completed", "cancelled", "no_show"]


class AvailabilityOut(BaseModel):
    date: date
    party_size: int
    slots: list[datetime]


class TableIn(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    seats: int = Field(ge=1, le=20)
    restaurant_id: str = Field(default="bistro-agh", max_length=50)
    zone: str = Field(default="Sala główna", max_length=80)


class TableOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    restaurant_id: str
    name: str
    seats: int
    zone: str
    is_active: bool


class OccupancyItem(BaseModel):
    table_id: int
    occupied: bool
    confidence: float | None = Field(default=None, ge=0, le=1)


class OccupancyBatch(BaseModel):
    camera_id: str | None = Field(default=None, max_length=50)
    items: list[OccupancyItem] = Field(min_length=1, max_length=200)


class TableStatusOut(BaseModel):
    id: int
    restaurant_id: str = "bistro-agh"
    name: str
    seats: int
    zone: str = "Sala główna"
    state: Literal["free", "reserved", "occupied", "unknown"]
    reserved: bool
    occupied: bool | None
    confidence: float | None = None
    camera_id: str | None = None
    occupancy_updated_at: UtcDatetime | None
    booked_for_slot: bool = False


class DetectionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    table_id: int
    table_name: str
    camera_id: str | None
    occupied: bool
    confidence: float | None
    detected_at: UtcDatetime
