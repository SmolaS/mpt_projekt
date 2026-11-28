import secrets
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Table(Base):
    __tablename__ = "tables"
    __table_args__ = (UniqueConstraint("restaurant_id", "name", name="uq_restaurant_table_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    restaurant_id: Mapped[str] = mapped_column(String(50), default="bistro-agh", index=True)
    name: Mapped[str] = mapped_column(String(50))
    seats: Mapped[int]
    zone: Mapped[str] = mapped_column(String(80), default="Sala główna")
    is_active: Mapped[bool] = mapped_column(default=True)


class Reservation(Base):
    __tablename__ = "reservations"

    id: Mapped[int] = mapped_column(primary_key=True)
    table_id: Mapped[int] = mapped_column(ForeignKey("tables.id"), index=True)
    guest_name: Mapped[str] = mapped_column(String(100))
    guest_email: Mapped[str] = mapped_column(String(255))
    guest_phone: Mapped[str | None] = mapped_column(String(30), default=None)
    party_size: Mapped[int]
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20), default="confirmed")  # confirmed | seated | completed | cancelled
    notes: Mapped[str | None] = mapped_column(String(255), default=None)
    cancel_token: Mapped[str] = mapped_column(
        String(64), default=lambda: secrets.token_urlsafe(24), unique=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    table: Mapped[Table] = relationship()

    @property
    def table_name(self) -> str:
        return self.table.name

    @property
    def restaurant_id(self) -> str:
        return self.table.restaurant_id


class TableOccupancy(Base):
    """Ostatni status zajętości stolika zgłoszony przez moduł kamery."""

    __tablename__ = "table_occupancy"

    table_id: Mapped[int] = mapped_column(ForeignKey("tables.id"), primary_key=True)
    occupied: Mapped[bool]
    confidence: Mapped[float | None] = mapped_column(Float, default=None)
    camera_id: Mapped[str | None] = mapped_column(String(50), default=None)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class DetectionLog(Base):
    """Historia odczytów detekcji YOLO z modułu kamer."""

    __tablename__ = "detection_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    table_id: Mapped[int] = mapped_column(ForeignKey("tables.id"), index=True)
    camera_id: Mapped[str | None] = mapped_column(String(50), default=None)
    occupied: Mapped[bool]
    confidence: Mapped[float | None] = mapped_column(Float, default=None)
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

    table: Mapped[Table] = relationship()

    @property
    def table_name(self) -> str:
        return self.table.name
