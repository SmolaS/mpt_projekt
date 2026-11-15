from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.config import settings

TZ = ZoneInfo("Europe/Warsaw")
API = "/api/v1"
CAM = {"X-API-Key": "camkey"}


def at(hour, minute=0, days=3):
    day = datetime.now(TZ).date() + timedelta(days=days)
    return datetime.combine(day, time(hour, minute), tzinfo=TZ)


def payload(start, size=8):
    return {
        "guest_name": "Anna Nowak",
        "guest_email": "anna@example.com",
        "party_size": size,
        "starts_at": start.isoformat(),
    }


def book(client, start, size=8):
    return client.post(f"{API}/reservations", json=payload(start, size))


# ---- rezerwacje i kolizje ----

def test_create_reservation(client):
    r = book(client, at(18))
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "confirmed" and body["cancel_token"]
    assert body["table_name"] == "Stolik 6"  # jedyny stolik na 8 osób


def test_picks_smallest_fitting_table(client):
    assert book(client, at(18), size=2).json()["table_name"] == "Stolik 1"


def test_same_slot_conflict(client):
    assert book(client, at(18)).status_code == 201
    assert book(client, at(18)).status_code == 409


def test_partial_overlap_conflict_but_back_to_back_ok(client):
    assert book(client, at(18)).status_code == 201          # 18:00–19:30
    assert book(client, at(19)).status_code == 409          # nakłada się
    assert book(client, at(19, 30)).status_code == 201      # zaczyna się, gdy poprzednia się kończy


def test_falls_back_to_next_table(client):
    assert book(client, at(18), size=6).json()["table_name"] == "Stolik 5"
    assert book(client, at(18), size=6).json()["table_name"] == "Stolik 6"  # większy, bo 6-osobowy zajęty
    assert book(client, at(18), size=6).status_code == 409


def test_validation_errors(client):
    assert book(client, at(18, days=-1)).status_code == 422       # przeszłość
    assert book(client, at(11)).status_code == 422                # przed otwarciem
    assert book(client, at(21)).status_code == 422                # skończyłaby się po zamknięciu
    assert book(client, at(18, 10)).status_code == 422            # poza siatką 30 min
    assert book(client, at(18), size=9).status_code == 422        # brak tak dużego stolika
    naive = payload(at(18)) | {"starts_at": "2030-01-01T18:00:00"}
    assert client.post(f"{API}/reservations", json=naive).status_code == 422  # brak strefy


def test_availability_excludes_taken_slots(client):
    day = at(12).date().isoformat()
    before = client.get(f"{API}/availability", params={"date": day, "party_size": 8}).json()["slots"]
    assert len(before) == 18  # 12:00–20:30 co 30 min
    book(client, at(18))
    after = client.get(f"{API}/availability", params={"date": day, "party_size": 8}).json()["slots"]
    starts = {datetime.fromisoformat(s).astimezone(TZ).strftime("%H:%M") for s in after}
    assert {"17:00", "17:30", "18:00", "18:30", "19:00"}.isdisjoint(starts)
    assert {"16:30", "19:30"} <= starts


def test_cancel_frees_slot(client):
    created = book(client, at(18)).json()
    rid = created["id"]
    assert client.post(f"{API}/reservations/{rid}/cancel", params={"token": "zly"}).status_code == 404
    assert client.post(f"{API}/reservations/{rid}/cancel").status_code == 404
    ok = client.post(f"{API}/reservations/{rid}/cancel", params={"token": created["cancel_token"]})
    assert ok.status_code == 200 and ok.json()["status"] == "cancelled"
    assert book(client, at(18)).status_code == 201


def test_staff_can_cancel_and_list(client, staff):
    rid = book(client, at(18)).json()["id"]
    day = at(18).date().isoformat()
    listing = client.get(f"{API}/reservations", params={"date": day}, headers=staff)
    assert [x["id"] for x in listing.json()] == [rid]
    assert client.post(f"{API}/reservations/{rid}/cancel", headers=staff).status_code == 200


# ---- autoryzacja ----

def test_auth(client):
    day = at(18).date().isoformat()
    assert client.get(f"{API}/reservations", params={"date": day}).status_code == 401
    assert client.get(f"{API}/tables/status").status_code == 401
    bad = client.post(f"{API}/auth/login", json={"username": "admin", "password": "x"})
    assert bad.status_code == 401


# ---- zajętość z kamery ----

def test_occupancy_requires_api_key(client):
    body = {"items": [{"table_id": 1, "occupied": True}]}
    assert client.post(f"{API}/occupancy", json=body).status_code == 401
    assert client.post(f"{API}/occupancy", json=body, headers={"X-API-Key": "zly"}).status_code == 401


def test_occupancy_flow(client, staff):
    body = {"camera_id": "cam-1", "items": [{"table_id": 1, "occupied": True, "confidence": 0.93},
                                            {"table_id": 2, "occupied": False}]}
    assert client.post(f"{API}/occupancy", json=body, headers=CAM).json() == {"updated": 2}
    status = {t["id"]: t for t in client.get(f"{API}/tables/status", headers=staff).json()}
    assert status[1]["state"] == "occupied"
    assert status[2]["state"] == "free"
    assert status[3]["state"] == "unknown"  # kamera nic nie zgłosiła

    # kolejny raport nadpisuje poprzedni
    client.post(f"{API}/occupancy", json={"items": [{"table_id": 1, "occupied": False}]}, headers=CAM)
    status = {t["id"]: t for t in client.get(f"{API}/tables/status", headers=staff).json()}
    assert status[1]["state"] == "free"


def test_occupancy_unknown_table_and_stale(client, staff, monkeypatch):
    bad = {"items": [{"table_id": 999, "occupied": True}]}
    assert client.post(f"{API}/occupancy", json=bad, headers=CAM).status_code == 404

    client.post(f"{API}/occupancy", json={"items": [{"table_id": 1, "occupied": True}]}, headers=CAM)
    monkeypatch.setattr(settings, "occupancy_ttl_seconds", -1)  # każdy status jest już nieaktualny
    status = {t["id"]: t for t in client.get(f"{API}/tables/status", headers=staff).json()}
    assert status[1]["state"] == "unknown" and status[1]["occupied"] is None
