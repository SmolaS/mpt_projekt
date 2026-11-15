"""Symulator modułu kamery do demo: co kilka sekund wysyła losowe statusy zajętości stolików.

Użycie:  python scripts/mock_camera.py [http://localhost:8000] [klucz_api] [liczba_stolików]
"""
import json
import random
import sys
import time
import urllib.request

base = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
key = sys.argv[2] if len(sys.argv) > 2 else "change-me-camera"
tables = int(sys.argv[3]) if len(sys.argv) > 3 else 6

while True:
    items = [
        {"table_id": i, "occupied": random.random() < 0.4, "confidence": round(random.uniform(0.7, 0.99), 2)}
        for i in range(1, tables + 1)
    ]
    req = urllib.request.Request(
        f"{base}/api/v1/occupancy",
        data=json.dumps({"camera_id": "mock-cam", "items": items}).encode(),
        headers={"Content-Type": "application/json", "X-API-Key": key},
    )
    with urllib.request.urlopen(req) as resp:
        print(resp.status, [(i["table_id"], i["occupied"]) for i in items])
    time.sleep(5)
