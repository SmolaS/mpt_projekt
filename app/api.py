from datetime import date

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import services
from .config import settings
from .db import get_db
from .models import Table
from .schemas import (
    AvailabilityOut,
    LoginIn,
    OccupancyBatch,
    ReservationCreate,
    ReservationCreated,
    ReservationOut,
    TableIn,
    TableOut,
    TableStatusOut,
    TokenOut,
)
from .security import create_token, optional_staff, require_camera_key, require_staff, same

router = APIRouter(prefix="/api/v1")


@router.get("/health")
def health():
    return {"status": "ok"}


@router.post("/auth/login", response_model=TokenOut)
def login(body: LoginIn):
    if not (same(body.username, settings.staff_username) and same(body.password, settings.staff_password)):
        raise HTTPException(401, "Nieprawidłowy login lub hasło")
    return TokenOut(access_token=create_token(body.username))


# ---------- rezerwacje ----------

@router.get("/availability", response_model=AvailabilityOut)
def get_availability(
    day: date = Query(alias="date"),
    party_size: int = Query(ge=1, le=20),
    db: Session = Depends(get_db),
):
    return AvailabilityOut(date=day, party_size=party_size, slots=services.availability(db, day, party_size))


@router.post("/reservations", response_model=ReservationCreated, status_code=201)
def create_reservation(body: ReservationCreate, background: BackgroundTasks, db: Session = Depends(get_db)):
    try:
        reservation = services.book(db, **body.model_dump())
    except services.NoTableAvailable as e:
        raise HTTPException(409, str(e))
    except services.BookingError as e:
        raise HTTPException(422, str(e))
    background.add_task(
        services.send_confirmation, reservation.guest_email, reservation.id, reservation.starts_at
    )
    return reservation


@router.get("/reservations", response_model=list[ReservationOut], dependencies=[Depends(require_staff)])
def list_reservations(day: date = Query(alias="date"), db: Session = Depends(get_db)):
    return services.list_reservations(db, day)


@router.post("/reservations/{reservation_id}/cancel", response_model=ReservationOut)
def cancel_reservation(
    reservation_id: int,
    token: str | None = Query(default=None),
    is_staff: bool = Depends(optional_staff),
    db: Session = Depends(get_db),
):
    reservation = services.cancel(db, reservation_id, token, is_staff)
    if reservation is None:
        raise HTTPException(404, "Nie znaleziono rezerwacji")
    return reservation


# ---------- stoliki i zajętość z kamery ----------

@router.get("/tables", response_model=list[TableOut], dependencies=[Depends(require_staff)])
def list_tables(db: Session = Depends(get_db)):
    return list(db.scalars(select(Table).order_by(Table.id)))


@router.post("/tables", response_model=TableOut, status_code=201, dependencies=[Depends(require_staff)])
def create_table(body: TableIn, db: Session = Depends(get_db)):
    if db.scalar(select(Table).where(Table.name == body.name)):
        raise HTTPException(409, "Stolik o tej nazwie już istnieje")
    table = Table(name=body.name, seats=body.seats)
    db.add(table)
    db.commit()
    return table


@router.get("/tables/status", response_model=list[TableStatusOut], dependencies=[Depends(require_staff)])
def tables_status(db: Session = Depends(get_db)):
    return services.table_status(db)


@router.post("/occupancy", dependencies=[Depends(require_camera_key)])
def receive_occupancy(body: OccupancyBatch, db: Session = Depends(get_db)):
    """Endpoint dla modułu kamery: raport zajętości jednego lub wielu stolików."""
    try:
        updated = services.save_occupancy(db, body.camera_id, body.items)
    except LookupError as e:
        raise HTTPException(404, str(e))
    return {"updated": updated}
