# Baza danych: rezerwacje stolików + wykrywanie zajętości (PostgreSQL 16)

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
Funkcja zapisuje zdarzenie i sama decyduje, czy zmienić stan (histereza, pewność, ręczne nadpisanie).

## Decyzje projektowe

* **Brak podwójnych rezerwacji gwarantuje baza**, a nie aplikacja: `EXCLUDE USING gist` na
  `reservation_tables`. Sprawdzone testem z dwiema równoległymi sesjami.
* **Metoda rozpoznawania stolika jest daną**: `table_detection_bindings.method`
  (`roi_zone`, `qr_marker`, `table_number_ocr`, `tag`, `manual`). Zmiana metody nie wymaga migracji
  i różne stoliki mogą używać różnych metod jednocześnie.
* **Histereza w bazie** (`record_occupancy_event`): domyślnie 3 zgodne detekcje z rzędu i pewność ≥ 0.6.
  Parametry da się zmienić argumentami funkcji.
* **`occupied → free` daje `needs_cleaning`**, a z tego stanu wyprowadza stolik pracownik
  (`set_table_state_manual`) albo nowa rezerwacja. Kamera sama go nie czyści.
* **`manual_override`**: ręczny stan ma pierwszeństwo przed wizją, dopóki wizja go nie potwierdzi.
* **RODO**: baza nie przechowuje obrazów, tylko wyniki detekcji (`raw` = wyjście modelu).

## Do zrobienia po stronie wdrożenia

* **Partycje**: `SELECT ensure_occupancy_partitions(2);` raz dziennie z crona (`pg_cron` lub systemowy).
  Funkcje zapisu tworzą brakującą partycję awaryjnie, ale lepiej mieć ją wcześniej.
* **Retencja**: stare partycje `occupancy_events` można odpinać i usuwać (`DROP TABLE occupancy_events_2026_01`).
* **Uprawnienia**: osobne role dla API klienta, API pracownika i potoku wizji (teraz wszystko działa na jednym użytkowniku).
  Dla klienta rozważ Row Level Security na `reservations` po `user_id`.
* **`available_slots`** nie uwzględnia łączenia stolików (np. dwa dwójki dla czwórki); sam zapis łączonych
  rezerwacji działa przez `create_reservation(..., ARRAY[1,2], ...)`.
* **Uwierzytelnianie**: `users.password_hash` jest tylko polem. Hasła powinien obsługiwać backend
  (bcrypt/argon2) lub zewnętrzny dostawca tożsamości.
