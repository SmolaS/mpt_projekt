import hmac
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer

from .config import settings

# Schematy bezpieczeństwa OpenAPI: dzięki nim Swagger UI pokazuje przycisk „Authorize".
bearer_scheme = HTTPBearer(auto_error=False, description="Token JWT z POST /auth/login (bez słowa Bearer)")
camera_key_scheme = APIKeyHeader(name="X-API-Key", auto_error=False, description="Klucz API modułu kamery")


def same(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode(), b.encode())


def create_token(username: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=8)
    return jwt.encode({"sub": username, "exp": exp}, settings.jwt_secret, algorithm="HS256")


def _staff_user(creds: HTTPAuthorizationCredentials | None) -> str | None:
    if creds is None:
        return None
    try:
        return jwt.decode(creds.credentials, settings.jwt_secret, algorithms=["HS256"])["sub"]
    except jwt.PyJWTError:
        return None


def require_staff(creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)) -> str:
    user = _staff_user(creds)
    if not user:
        raise HTTPException(401, "Wymagane logowanie", headers={"WWW-Authenticate": "Bearer"})
    return user


def optional_staff(creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)) -> bool:
    return _staff_user(creds) is not None


def require_camera_key(api_key: str | None = Depends(camera_key_scheme)) -> None:
    if not api_key or not same(api_key, settings.camera_api_key):
        raise HTTPException(401, "Nieprawidłowy klucz API kamery")
