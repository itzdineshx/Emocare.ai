from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo.errors import OperationFailure

from app.core.config import get_settings

settings = get_settings()
client = AsyncIOMotorClient(settings.mongodb_url)


def get_database_client() -> AsyncIOMotorDatabase:
    return client[settings.mongodb_db_name]


async def get_database():
    yield get_database_client()


async def init_mongo() -> None:
    db = get_database_client()

    # Ensure old index definitions are replaced safely during local/prod upgrades.
    for index_name in ("uq_source_external_id", "uq_source_idempotency_key"):
        try:
            await db.emotion_events.drop_index(index_name)
        except OperationFailure:
            pass

    await db.emotion_events.create_index(
        [("source", 1), ("external_id", 1)],
        unique=True,
        partialFilterExpression={"external_id": {"$exists": True, "$type": "string"}},
        name="uq_source_external_id",
    )
    await db.emotion_events.create_index(
        [("source", 1), ("idempotency_key", 1)],
        unique=True,
        partialFilterExpression={"idempotency_key": {"$exists": True, "$type": "string"}},
        name="uq_source_idempotency_key",
    )
    await db.emotion_events.create_index([("source", 1), ("detected_at", -1)], name="idx_source_detected_at")
    await db.emotion_events.create_index([("child_id", 1), ("detected_at", -1)], name="idx_child_detected_at")
    await db.emotion_events.create_index([("session_id", 1)], name="idx_session_id")

    await db.chat_messages.create_index([("source", 1), ("session_id", 1), ("created_at", 1)], name="idx_chat_session")
    await db.chat_messages.create_index([("child_id", 1), ("created_at", 1)], name="idx_chat_child_created")
    await db.sync_cursors.create_index([("source", 1)], unique=True, name="uq_source")

    await db.users.create_index([("email", 1)], unique=True, name="uq_user_email")
    await db.users.create_index([("user_id", 1)], unique=True, name="uq_user_id")
    await db.users.create_index([("parent_id", 1)], name="idx_user_parent_id")
