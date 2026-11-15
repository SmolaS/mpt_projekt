import os

os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["STAFF_PASSWORD"] = "secret"
os.environ["CAMERA_API_KEY"] = "camkey"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture
def client():
    Base.metadata.drop_all(engine)
    with TestClient(app) as c:  # lifespan: create_all + dane demo (stoliki 2,2,4,4,6,8 miejsc)
        yield c


@pytest.fixture
def staff(client):
    r = client.post("/api/v1/auth/login", json={"username": "admin", "password": "secret"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}
