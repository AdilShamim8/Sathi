"""JWT Authentication utilities and FastAPI dependency injection (architecture §7 / invariant 7).

Tokens are signed using AUTH_SECRET. Routes under /v1/me/* obtain user_id
exclusively from this verified token — never from client route or query params.
"""
from __future__ import annotations

import datetime as dt
from typing import Annotated

import jwt
from fastapi import Header, HTTPException

from api.config import get_settings
from api.errors import UnauthenticatedError


def create_access_token(user_id: str, persona: str, expires_delta_minutes: int | None = None) -> str:
    """Generate a signed JWT token for the synthetic demo user."""
    settings = get_settings()
    minutes = expires_delta_minutes or settings.token_ttl_minutes
    expire = dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=minutes)
    payload = {
        "sub": user_id,
        "persona": persona,
        "exp": int(expire.timestamp()),
        "iat": int(dt.datetime.now(dt.timezone.utc).timestamp()),
    }
    return jwt.encode(payload, settings.auth_secret, algorithm="HS256")


def decode_access_token(token: str) -> dict:
    """Decode and verify JWT signature and expiration."""
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.auth_secret, algorithms=["HS256"])
        return payload
    except jwt.PyJWTError:
        raise UnauthenticatedError()


def get_current_user_id(authorization: Annotated[str | None, Header()] = None) -> str:
    """FastAPI dependency: extracts verified user_id from Authorization: Bearer <token>."""
    if not authorization:
        raise UnauthenticatedError()
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise UnauthenticatedError()
    payload = decode_access_token(parts[1])
    user_id = payload.get("sub")
    if not user_id:
        raise UnauthenticatedError()
    return user_id
