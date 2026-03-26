from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import get_settings

settings = get_settings()
client = AsyncIOMotorClient(settings.mongodb_url)


def get_database_client() -> AsyncIOMotorDatabase:
    return client[settings.mongodb_db_name]


async def get_database():
    yield get_database_client()


async def init_mongo() -> None:
    db = get_database_client()

    await db.emotion_events.create_index(
        [("source", 1), ("external_id", 1)],
        unique=True,
        sparse=True,
        name="uq_source_external_id",
    )
    await db.emotion_events.create_index(
        [("source", 1), ("idempotency_key", 1)],
        unique=True,
        sparse=True,
        name="uq_source_idempotency_key",
    )
    await db.emotion_events.create_index([("source", 1), ("detected_at", -1)], name="idx_source_detected_at")
    await db.emotion_events.create_index([("session_id", 1)], name="idx_session_id")

    await db.chat_messages.create_index([("source", 1), ("session_id", 1), ("created_at", 1)], name="idx_chat_session")
    await db.sync_cursors.create_index([("source", 1)], unique=True, name="uq_source")
