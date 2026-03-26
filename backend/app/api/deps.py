from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import get_settings
from app.core.security import decode_access_token
from app.db.mongo import get_database
from app.services.auth_service import get_user_by_id, is_child_owned_by_parent, list_children_for_parent

settings = get_settings()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


async def get_current_user_optional(
    db: AsyncIOMotorDatabase = Depends(get_database),
    token: str | None = Depends(oauth2_scheme),
) -> dict | None:
    if not token:
        if settings.auth_required:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
        return None

    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")

    user = await get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return user


async def get_current_user_required(current_user: dict | None = Depends(get_current_user_optional)) -> dict:
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return current_user


async def require_parent_user(current_user: dict = Depends(get_current_user_required)) -> dict:
    if current_user.get("role") != "parent":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Parent role required")
    return current_user


async def resolve_child_scope(
    db: AsyncIOMotorDatabase,
    current_user: dict | None,
    requested_child_id: str | None,
) -> tuple[str | None, list[str] | None]:
    if current_user is None:
        if requested_child_id:
            return requested_child_id, [requested_child_id]
        return None, None

    role = current_user.get("role")
    user_id = current_user.get("user_id")

    if role == "child":
        return user_id, [user_id]

    if role == "parent":
        if requested_child_id:
            owns_child = await is_child_owned_by_parent(db, user_id, requested_child_id)
            if not owns_child:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Child does not belong to parent")
            return requested_child_id, [requested_child_id]

        children = await list_children_for_parent(db, user_id)
        child_ids = [child["user_id"] for child in children]
        return None, child_ids

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unsupported user role")
