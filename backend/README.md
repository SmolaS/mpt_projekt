# Backend: rezerwacje stolików

FastAPI + SQLAlchemy + PostgreSQL. Zakres: zapis rezerwacji, kontrola kolizji terminów, odbiór statusów zajętości stolików z modułu kamery.

## Uruchomienie

**Docker (PostgreSQL):** `cp .env.example .env && docker compose up --build` → http://localhost:8000/docs

**Testy:** `pip install -r requirements-dev.txt && pytest`

## Endpointy

| Endpoint | Dostęp |
|---|---|
| `GET /health` | publiczny |
| `POST /auth/login` | publiczny |
| `GET /availability?date=&party_size=` | publiczny |
| `POST /reservations` | publiczny |
| `POST /reservations/{id}/cancel?token=` | token z e-maila lub pracownik |
| `GET /reservations?date=` | pracownik (JWT) |
| `GET /tables`, `POST /tables`, `GET /tables/status` | pracownik (JWT) |
| `POST /occupancy` | klucz API kamery (`X-API-Key`) |
