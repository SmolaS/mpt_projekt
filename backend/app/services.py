import logging
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .config import settings
from .models import Reservation, Table, TableOccupancy, utcnow
from .schemas import OccupancyItem
from .security import same

log = logging.getLogger("reservations")
TZ = ZoneInfo(settings.timezone)
UTC = timezone.utc


class BookingError(Exception):
    """Błąd walidacji rezerwacji (HTTP 422)."""


class NoTableAvailable(Exception):
    """Brak wolnego stolika w terminie (HTTP 409)."""


def as_utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=UTC) if dt.tzinfo is None else dt.astimezone(UTC)


def _duration() -> timedelta:
    return timedelta(minutes=settings.reservation_minutes)


# ---------- rezerwacje i kolizje terminów ----------

def validate_slot(start: datetime) -> None:
    local = start.astimezone(TZ)
    end_local = local + _duration()
    if start <= datetime.now(UTC):
        raise BookingError("Termin musi być w przyszłości")
    if (local.hour * 60 + local.minute) % settings.slot_step_minutes or local.second or local.microsecond:
        raise BookingError(f"Rezerwacje przyjmujemy co {settings.slot_step_minutes} minut")
    if (
        end_local.date() != local.date()
        or local.time() < settings.open_time
        or end_local.time() > settings.close_time
    ):
        raise BookingError("Termin poza godzinami otwarcia")


def _candidate_tables(db: Session, party_size: int) -> list[Table]:
    q = (
        select(Table)
        .where(Table.is_active.is_(True), Table.seats >= party_size)
        .order_by(Table.seats, Table.id)  # najpierw najmniejszy pasujący stolik
    )
    return list(db.scalars(q))


def _busy_table_ids(db: Session, start: datetime, end: datetime) -> set[int]:
    """Stoliki, które mają potwierdzoną rezerwację nakładającą się na [start, end)."""
    q = select(Reservation.table_id).where(
        Reservation.status == "confirmed",
        Reservation.starts_at < end,
        Reservation.ends_at > start,
    )
    return set(db.scalars(q))


def book(
    db: Session,
    *,
    guest_name: str,
    guest_email: str,
    guest_phone: str | None,
    party_size: int,
    starts_at: datetime,
) -> Reservation:
    start = as_utc(starts_at)
    validate_slot(start)
    end = start + _duration()

    tables = _candidate_tables(db, party_size)
    if not tables:
        raise BookingError("Nie mamy stolika dla tak licznej grupy")

    busy = _busy_table_ids(db, start, end)
    for table in tables:
        if table.id in busy:
            continue
        reservation = Reservation(
            table_id=table.id,
            guest_name=guest_name,
            guest_email=guest_email,
            guest_phone=guest_phone,
            party_size=party_size,
            starts_at=start,
            ends_at=end,
        )
        db.add(reservation)
        try:
            db.commit()
        except IntegrityError:
            # wyścig: ktoś zajął ten stolik chwilę wcześniej (ograniczenie EXCLUDE w PostgreSQL)
            db.rollback()
            continue
        return reservation
    raise NoTableAvailable("Brak wolnego stolika w tym terminie")


def availability(db: Session, day: date, party_size: int) -> list[datetime]:
    tables = _candidate_tables(db, party_size)
    if not tables:
        return []
    open_dt = datetime.combine(day, settings.open_time, tzinfo=TZ)
    close_dt = datetime.combine(day, settings.close_time, tzinfo=TZ)
    rows = db.execute(
        select(Reservation.table_id, Reservation.starts_at, Reservation.ends_at).where(
            Reservation.status == "confirmed",
            Reservation.table_id.in_([t.id for t in tables]),
            Reservation.starts_at < as_utc(close_dt),
            Reservation.ends_at > as_utc(open_dt),
        )
    ).all()
    booked = [(r.table_id, as_utc(r.starts_at), as_utc(r.ends_at)) for r in rows]

    now = datetime.now(UTC)
    slots: list[datetime] = []
    cur = open_dt
    while cur + _duration() <= close_dt:
        s = as_utc(cur)
        e = s + _duration()

        def is_free(t: Table) -> bool:
            return not any(tid == t.id and bs < e and be > s for tid, bs, be in booked)

        if s > now and any(is_free(t) for t in tables):
            slots.append(cur)
        cur += timedelta(minutes=settings.slot_step_minutes)
    return slots


def list_reservations(db: Session, day: date) -> list[Reservation]:
    start = as_utc(datetime.combine(day, time.min, tzinfo=TZ))
    end = as_utc(datetime.combine(day + timedelta(days=1), time.min, tzinfo=TZ))
    q = (
        select(Reservation)
        .where(Reservation.starts_at >= start, Reservation.starts_at < end)
        .order_by(Reservation.starts_at, Reservation.table_id)
    )
    return list(db.scalars(q))


def cancel(db: Session, reservation_id: int, token: str | None, is_staff: bool) -> Reservation | None:
    """Zwraca rezerwację albo None, gdy nie istnieje lub token jest błędny (celowo nie rozróżniamy)."""
    r = db.get(Reservation, reservation_id)
    if r is None or not (is_staff or (token and same(token, r.cancel_token))):
        return None
    if r.status != "cancelled":
        r.status = "cancelled"
        db.commit()
    return r


def send_confirmation(email: str, reservation_id: int, starts_at: datetime) -> None:
    # POC: tylko log. Docelowo SMTP / zewnętrzny dostawca e-maili.
    log.info("E-mail potwierdzający rezerwację #%s dla %s (%s)", reservation_id, email, starts_at)


# ---------- zajętość stolików z modułu kamery ----------

def save_occupancy(db: Session, camera_id: str | None, items: list[OccupancyItem]) -> int:
    known = set(db.scalars(select(Table.id)))
    missing = sorted({i.table_id for i in items} - known)
    if missing:
        raise LookupError(f"Nieznane stoliki: {missing}")
    now = utcnow()
    for item in items:
        row = db.get(TableOccupancy, item.table_id)
        if row is None:
            row = TableOccupancy(table_id=item.table_id)
            db.add(row)
        row.occupied = item.occupied
        row.confidence = item.confidence
        row.camera_id = camera_id
        row.updated_at = now
    db.commit()
    return len(items)


def table_status(db: Session) -> list[dict]:
    now = datetime.now(UTC)
    tables = db.scalars(select(Table).where(Table.is_active.is_(True)).order_by(Table.id))
    occupancy = {o.table_id: o for o in db.scalars(select(TableOccupancy))}
    reserved_now = _busy_table_ids(db, now, now + timedelta(seconds=1))

    result = []
    for t in tables:
        o = occupancy.get(t.id)
        fresh = o is not None and (now - as_utc(o.updated_at)).total_seconds() <= settings.occupancy_ttl_seconds
        occupied = o.occupied if fresh else None
        reserved = t.id in reserved_now
        if occupied:
            state = "occupied"
        elif reserved:
            state = "reserved"
        elif occupied is None:
            state = "unknown"
        else:
            state = "free"
        result.append(
            {
                "id": t.id,
                "name": t.name,
                "seats": t.seats,
                "state": state,
                "reserved": reserved,
                "occupied": occupied,
                "occupancy_updated_at": o.updated_at if o else None,
            }
        )
    return result
