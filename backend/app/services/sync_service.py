from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Iterable

import httpx
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.schemas import ChatMessageIn, DashboardSummaryOut, EmotionEventIn, SyncPullRequest, SyncPullResponse


def _normalize_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _serialize_id(doc: dict) -> dict:
    serialized = {**doc}
    serialized["id"] = str(serialized.pop("_id"))
    return serialized


async def upsert_emotion_event(db: AsyncIOMotorDatabase, payload: EmotionEventIn) -> tuple[dict, bool]:
    detected_at = _normalize_utc(payload.detected_at)

    events = db.emotion_events
    existing = None
    if payload.external_id:
        existing = await events.find_one({"source": payload.source, "external_id": payload.external_id})

    if existing is None and payload.idempotency_key:
        existing = await events.find_one({"source": payload.source, "idempotency_key": payload.idempotency_key})

    update_data = {
        "source": payload.source,
        "external_id": payload.external_id,
        "idempotency_key": payload.idempotency_key,
        "child_id": payload.child_id,
        "session_id": payload.session_id,
        "emotion": payload.emotion,
        "confidence": payload.confidence,
        "gesture": payload.gesture,
        "transcript": payload.transcript,
        "detected_at": detected_at,
        "updated_at": datetime.now(timezone.utc),
    }

    if existing is None:
        update_data["created_at"] = datetime.now(timezone.utc)
        result = await events.insert_one(update_data)
        created = await events.find_one({"_id": result.inserted_id})
        return _serialize_id(created or update_data), True

    await events.update_one({"_id": existing["_id"]}, {"$set": update_data})
    updated = await events.find_one({"_id": existing["_id"]})
    return _serialize_id(updated or existing), False


async def bulk_upsert_events(db: AsyncIOMotorDatabase, events: Iterable[EmotionEventIn]) -> tuple[int, int]:
    inserted = 0
    updated = 0

    for event in events:
        _, created = await upsert_emotion_event(db, event)
        if created:
            inserted += 1
        else:
            updated += 1

    return inserted, updated


async def create_chat_message(db: AsyncIOMotorDatabase, payload: ChatMessageIn) -> dict:
    message = {
        "source": payload.source,
        "session_id": payload.session_id,
        "role": payload.role,
        "text": payload.text,
        "emotion": payload.emotion,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.chat_messages.insert_one(message)
    created = await db.chat_messages.find_one({"_id": result.inserted_id})
    return _serialize_id(created or message)


async def list_chat_messages(db: AsyncIOMotorDatabase, source: str, session_id: str, limit: int) -> list[dict]:
    cursor = (
        db.chat_messages.find({"source": source, "session_id": session_id})
        .sort("created_at", -1)
        .limit(limit)
    )
    docs = await cursor.to_list(length=limit)
    docs.reverse()
    return [_serialize_id(doc) for doc in docs]


async def list_recent_events(db: AsyncIOMotorDatabase, source: str | None, limit: int) -> list[dict]:
    query: dict = {}
    if source:
        query["source"] = source

    docs = await db.emotion_events.find(query).sort("detected_at", -1).limit(limit).to_list(length=limit)
    return [_serialize_id(doc) for doc in docs]


async def get_dashboard_summary(db: AsyncIOMotorDatabase, source: str | None, hours: int) -> DashboardSummaryOut:
    since = datetime.now(timezone.utc).replace(microsecond=0) - timedelta(hours=hours)

    filters: dict = {"detected_at": {"$gte": since}}
    if source:
        filters["source"] = source

    total_events = await db.emotion_events.count_documents(filters)

    avg_pipeline = [{"$match": filters}, {"$group": {"_id": None, "avg": {"$avg": "$confidence"}}}]
    avg_rows = await db.emotion_events.aggregate(avg_pipeline).to_list(length=1)
    avg_confidence = float(avg_rows[0]["avg"]) if avg_rows else 0.0

    primary_pipeline = [
        {"$match": filters},
        {"$group": {"_id": "$emotion", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 1},
    ]
    primary_rows = await db.emotion_events.aggregate(primary_pipeline).to_list(length=1)
    primary_emotion = str(primary_rows[0]["_id"]) if primary_rows else "None"

    alert_filters = {**filters, "emotion": {"$in": ["Sad", "Angry"]}}
    alert_events = await db.emotion_events.count_documents(alert_filters)

    return DashboardSummaryOut(
        source=source,
        total_events=int(total_events),
        primary_emotion=primary_emotion,
        avg_confidence=round(avg_confidence, 2),
        alert_events=int(alert_events),
        window_hours=hours,
    )


async def _upsert_cursor(db: AsyncIOMotorDatabase, source: str, fetched: int) -> None:
    existing = await db.sync_cursors.find_one({"source": source})
    now = datetime.now(timezone.utc)
    if existing is None:
        await db.sync_cursors.insert_one(
            {
                "source": source,
                "last_successful_sync_at": now,
                "records_received": fetched,
                "updated_at": now,
            }
        )
        return

    await db.sync_cursors.update_one(
        {"source": source},
        {
            "$set": {
                "last_successful_sync_at": now,
                "updated_at": now,
            },
            "$inc": {"records_received": fetched},
        },
    )


async def pull_and_sync_remote(db: AsyncIOMotorDatabase, payload: SyncPullRequest) -> SyncPullResponse:
    params: dict[str, str] = {}
    if payload.since:
        params["since"] = _normalize_utc(payload.since).isoformat()

    headers: dict[str, str] = {}
    if payload.api_key:
        headers["Authorization"] = f"Bearer {payload.api_key}"

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(payload.url, params=params, headers=headers)
        response.raise_for_status()
        body = response.json()

    raw_events = body.get("events", body) if isinstance(body, dict) else body
    if not isinstance(raw_events, list):
        raise ValueError("Remote sync endpoint must return a list or an object with 'events'.")

    normalized_events: list[EmotionEventIn] = []
    for item in raw_events:
        if not isinstance(item, dict):
            continue

        item_data = {**item}
        item_data["source"] = payload.source
        normalized_events.append(EmotionEventIn.model_validate(item_data))

    inserted, updated = await bulk_upsert_events(db, normalized_events)
    await _upsert_cursor(db, payload.source, len(normalized_events))

    return SyncPullResponse(
        source=payload.source,
        fetched=len(normalized_events),
        inserted=inserted,
        updated=updated,
    )
