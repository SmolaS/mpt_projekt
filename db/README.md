# Baza danych: rezerwacje stolików + wykrywanie zajętości

## Uruchomienie

```bash
docker compose up -d          # baza z migracjami i danymi demo
# albo na własnym Postgresie:
make migrate seed DB=postgresql://user:pass@host:5432/baza
make test                     # 28 testów scenariuszy
```

Migracje (`migrations/`) uruchamiaj w kolejności numerów:

| Plik | Zawartość |
|---|---|
| `001_core.sql` | restauracje, godziny otwarcia, sale, stoliki, użytkownicy, personel |
| `002_reservations.sql` | rezerwacje, `reservation_tables` z blokadą nakładania się, audyt, NOTIFY |
| `003_vision.sql` | kamery, powiązania stolik↔obraz, log zdarzeń (partycje), stan na żywo |
| `004_api.sql` | funkcje dla aplikacji i widok mapy sali |

## Jak aplikacja z tego korzysta

### Interfejs klienta
```sql
-- wolne godziny na dany dzień dla 4 osób
SELECT * FROM available_slots(1, 4, '2026-12-19');

-- konkretne stoliki dla wybranego terminu
SELECT * FROM find_available_tables(1, 4, '2026-12-19 18:00+01', '2026-12-19 19:30+01');

-- rezerwacja (zwraca id; błąd 23P01 = ktoś zajął stolik w międzyczasie, pokaż inne terminy)
SELECT create_reservation(1, 'Jan Kowalski', 4, '2026-12-19 18:00+01',
                          ARRAY[3], 'client_app', p_user_id => 1);
```

### Interfejs pracownika
```sql
SELECT * FROM v_floor_map WHERE restaurant_id = 1;          -- mapa sali ze stanami
SELECT set_reservation_status(42, 'seated', 2);             -- goście usiedli
SELECT set_reservation_status(42, 'completed', 2);          -- wyszli -> stolik needs_cleaning
SELECT set_table_state_manual(3, 'free', 2);                -- "posprzątane"
SELECT create_reservation(1, 'Bez rezerwacji', 2, now(), ARRAY[1], 'walk_in', p_created_by => 2);
LISTEN table_state;                                         -- push zmian stanu stolików
LISTEN reservation_changed;                                 -- push zmian rezerwacji
```

### Potok wizji (Python/inne, osobny proces)
```sql
SELECT record_occupancy_event(
  p_table_id => 3, p_state => 'occupied', p_confidence => 0.93, p_camera_id => 1,
  p_people_count => 2, p_model_version => 'yolo-v8-0.3', p_raw => '{"bbox": [..]}'::jsonb);
```

