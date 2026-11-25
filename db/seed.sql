-- seed.sql: dane demonstracyjne (jedna restauracja, 8 stolików, 2 kamery, kilka rezerwacji)

INSERT INTO restaurants (name) VALUES ('Trattoria Demo');

INSERT INTO opening_hours (restaurant_id, weekday, opens_at, closes_at)
SELECT 1, d, '12:00', '22:00' FROM generate_series(0, 6) d;

INSERT INTO areas (restaurant_id, name) VALUES (1, 'Sala główna'), (1, 'Taras');

INSERT INTO dining_tables (restaurant_id, area_id, label, seats_min, seats_max, layout_x, layout_y) VALUES
  (1, 1, '1', 1, 2, 0.10, 0.15),
  (1, 1, '2', 1, 2, 0.10, 0.45),
  (1, 1, '3', 2, 4, 0.40, 0.15),
  (1, 1, '4', 2, 4, 0.40, 0.45),
  (1, 1, '5', 4, 6, 0.70, 0.30),
  (1, 2, 'T1', 2, 4, 0.20, 0.85),
  (1, 2, 'T2', 2, 4, 0.50, 0.85),
  (1, 2, 'T3', 4, 8, 0.80, 0.85);

INSERT INTO users (email, full_name, phone) VALUES
  ('klient@example.com',   'Jan Kowalski',  '+48500100200'),
  ('host@example.com',     'Anna Host',     '+48500100201'),
  ('manager@example.com',  'Piotr Manager', '+48500100202');

INSERT INTO staff_memberships (user_id, restaurant_id, role) VALUES
  (2, 1, 'host'),
  (3, 1, 'manager');

INSERT INTO cameras (restaurant_id, area_id, name, stream_url) VALUES
  (1, 1, 'Kamera sala', 'rtsp://camera-sala.local/stream'),
  (1, 2, 'Kamera taras', 'rtsp://camera-taras.local/stream');

-- Metoda rozpoznawania jeszcze nie wybrana: część stolików po strefie obrazu (ROI),
-- część po markerze QR, żeby pokazać, że schemat obsługuje obie jednocześnie.
INSERT INTO table_detection_bindings (table_id, camera_id, method, roi) VALUES
  (1, 1, 'roi_zone', '{"points": [[0.05,0.10],[0.20,0.10],[0.20,0.25],[0.05,0.25]]}'),
  (2, 1, 'roi_zone', '{"points": [[0.05,0.40],[0.20,0.40],[0.20,0.55],[0.05,0.55]]}');
INSERT INTO table_detection_bindings (table_id, camera_id, method, marker_value) VALUES
  (3, 1, 'qr_marker', 'TABLE-3'),
  (4, 1, 'qr_marker', 'TABLE-4'),
  (5, 1, 'qr_marker', 'TABLE-5');
