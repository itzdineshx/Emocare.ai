from __future__ import annotations

from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.security import hash_password, verify_password


def _serialize_user(doc: dict) -> dict:
    user = {**doc}
    user["id"] = str(user.pop("_id"))
    return user


async def get_user_by_email(db: AsyncIOMotorDatabase, email: str) -> dict | None:
    return await db.users.find_one({"email": email.lower().strip()})


async def get_user_by_id(db: AsyncIOMotorDatabase, user_id: str) -> dict | None:
    return await db.users.find_one({"user_id": user_id})


async def register_parent(db: AsyncIOMotorDatabase, *, name: str, email: str, password: str) -> dict:
    normalized_email = email.lower().strip()
    if await get_user_by_email(db, normalized_email):
        raise ValueError("Email is already registered")

    parent_doc = {
        "user_id": f"parent-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
        "name": name.strip(),
        "email": normalized_email,
        "role": "parent",
        "parent_id": None,
        "password_hash": hash_password(password),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    result = await db.users.insert_one(parent_doc)
    created = await db.users.find_one({"_id": result.inserted_id})
    return _serialize_user(created or parent_doc)


async def create_child_account(
    db: AsyncIOMotorDatabase,
    *,
    parent_user_id: str,
    name: str,
    username: str,
    email: str | None,
    age: int | None,
    grade: str | None,
    interests: list[str] | None,
    password: str,
) -> dict:
    normalized_username = username.lower().strip()
    existing_username = await db.users.find_one(
        {
            "role": "child",
            "parent_id": parent_user_id,
            "username": normalized_username,
        }
    )
    if existing_username:
        raise ValueError("Username is already used under this parent")

    normalized_email: str
    if email:
        normalized_email = email.lower().strip()
        if await get_user_by_email(db, normalized_email):
            raise ValueError("Email is already registered")
    else:
        normalized_email = f"{normalized_username}.{int(datetime.now(timezone.utc).timestamp())}@child.local"

    normalized_interests = [item.strip() for item in (interests or []) if item and item.strip()]

    child_doc = {
        "user_id": f"child-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
        "name": name.strip(),
        "username": normalized_username,
        "email": normalized_email,
        "role": "child",
        "parent_id": parent_user_id,
        "age": age,
        "grade": grade.strip() if grade else None,
        "interests": normalized_interests,
        "password_hash": hash_password(password),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    result = await db.users.insert_one(child_doc)
    created = await db.users.find_one({"_id": result.inserted_id})
    return _serialize_user(created or child_doc)


async def authenticate_user(
    db: AsyncIOMotorDatabase,
    *,
    email: str | None,
    username: str | None,
    parent_id: str | None,
    password: str,
    parent_email: str | None = None,
) -> dict | None:
    user = None

    if username and parent_id:
        user = await db.users.find_one(
            {
                "role": "child",
                "username": username.lower().strip(),
                "parent_id": parent_id.strip(),
            }
        )

    elif email and parent_email:
        normalized_email = email.lower().strip()

        normalized_parent_email = parent_email.lower().strip()
        parent = await db.users.find_one({"email": normalized_parent_email, "role": "parent"})
        if not parent:
            return None

        user = await db.users.find_one(
            {
                "email": normalized_email,
                "role": "child",
                "parent_id": parent.get("user_id"),
            }
        )

    elif email:
        normalized_email = email.lower().strip()
        user = await get_user_by_email(db, normalized_email)

    if not user:
        return None

    if not verify_password(password, user.get("password_hash", "")):
        return None

    return _serialize_user(user)


async def list_children_for_parent(db: AsyncIOMotorDatabase, parent_user_id: str) -> list[dict]:
    docs = await db.users.find({"role": "child", "parent_id": parent_user_id}).to_list(length=500)
    return [_serialize_user(doc) for doc in docs]


async def is_child_owned_by_parent(db: AsyncIOMotorDatabase, parent_user_id: str, child_user_id: str) -> bool:
    child = await db.users.find_one({"role": "child", "user_id": child_user_id, "parent_id": parent_user_id})
    return child is not None
