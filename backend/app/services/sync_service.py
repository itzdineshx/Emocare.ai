from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Iterable

import httpx
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.schemas import ChatMessageIn, DashboardSummaryOut, EmotionEventIn, SyncPullRequest, SyncPullResponse, SystemLogIn


def _normalize_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _serialize_id(doc: dict) -> dict:
    serialized = {**doc}
    serialized["id"] = str(serialized.pop("_id"))
    return serialized


def _without_none_values(data: dict) -> dict:
    return {key: value for key, value in data.items() if value is not None}


def _derive_related_endpoint(base_url: str, target: str) -> str:
    if "/sync/export/events" in base_url:
        return base_url.replace("/sync/export/events", f"/sync/export/{target}")
    if "/events/recent" in base_url:
        return base_url.replace("/events/recent", f"/sync/export/{target}")
    if "/events" in base_url:
        return base_url.replace("/events", f"/sync/export/{target}")
    return base_url.rstrip("/") + f"/sync/export/{target}"


def _parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return _normalize_utc(datetime.fromisoformat(value.replace("Z", "+00:00")))
    except Exception:
        return None


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
        "parent_id": payload.parent_id,
        "user_id": payload.user_id,
        "session_id": payload.session_id,
        "emotion": payload.emotion,
        "confidence": payload.confidence,
        "gesture": payload.gesture,
        "transcript": payload.transcript,
        "detected_at": detected_at,
        "updated_at": datetime.now(timezone.utc),
    }

    cleaned_update_data = _without_none_values(update_data)
    unset_fields = {key: "" for key, value in update_data.items() if value is None}

    if existing is None:
        cleaned_update_data["created_at"] = datetime.now(timezone.utc)
        result = await events.insert_one(cleaned_update_data)
        created = await events.find_one({"_id": result.inserted_id})
        return _serialize_id(created or cleaned_update_data), True

    update_ops: dict[str, dict] = {"$set": cleaned_update_data}
    if unset_fields:
        update_ops["$unset"] = unset_fields

    await events.update_one({"_id": existing["_id"]}, update_ops)
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
        "child_id": payload.child_id,
        "user_id": payload.child_id,
        "role": payload.role,
        "text": payload.text,
        "emotion": payload.emotion,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.chat_messages.insert_one(message)
    created = await db.chat_messages.find_one({"_id": result.inserted_id})
    return _serialize_id(created or message)


async def create_system_log(db: AsyncIOMotorDatabase, payload: SystemLogIn) -> dict:
    log_doc = {
        "source": payload.source,
        "level": payload.level,
        "category": payload.category,
        "message": payload.message,
        "child_id": payload.child_id,
        "parent_id": payload.parent_id,
        "user_id": payload.user_id,
        "session_id": payload.session_id,
        "context": payload.context,
        "created_at": datetime.now(timezone.utc),
    }
    cleaned = _without_none_values(log_doc)
    result = await db.system_logs.insert_one(cleaned)
    created = await db.system_logs.find_one({"_id": result.inserted_id})
    return _serialize_id(created or cleaned)


async def list_chat_messages(
    db: AsyncIOMotorDatabase,
    source: str,
    session_id: str | None,
    limit: int,
    child_ids: list[str] | None = None,
    since: datetime | None = None,
) -> list[dict]:
    query: dict = {"source": source}
    if session_id:
        query["session_id"] = session_id
    if child_ids is not None:
        if not child_ids:
            return []
        query["child_id"] = {"$in": child_ids}

    if since is not None:
        query["created_at"] = {"$gte": _normalize_utc(since)}

    cursor = (
        db.chat_messages.find(query)
        .sort("created_at", -1)
        .limit(limit)
    )
    docs = await cursor.to_list(length=limit)
    docs.reverse()
    return [_serialize_id(doc) for doc in docs]


async def list_conversation_threads(
    db: AsyncIOMotorDatabase,
    source: str | None,
    limit: int,
    child_ids: list[str] | None = None,
) -> list[dict]:
    match: dict = {}
    if source:
        match["source"] = source

    if child_ids is not None:
        if not child_ids:
            return []
        match["child_id"] = {"$in": child_ids}

    pipeline = [
        {"$match": match},
        {"$sort": {"created_at": 1}},
        {
            "$group": {
                "_id": {
                    "source": "$source",
                    "session_id": "$session_id",
                    "child_id": "$child_id",
                },
                "total_messages": {"$sum": 1},
                "last_message_at": {"$last": "$created_at"},
                "last_role": {"$last": "$role"},
                "last_text": {"$last": "$text"},
            }
        },
        {"$sort": {"last_message_at": -1}},
        {"$limit": limit},
    ]

    rows = await db.chat_messages.aggregate(pipeline).to_list(length=limit)
    return [
        {
            "source": row["_id"]["source"],
            "session_id": row["_id"]["session_id"],
            "child_id": row["_id"].get("child_id"),
            "total_messages": int(row.get("total_messages", 0)),
            "last_message_at": row["last_message_at"],
            "last_role": row.get("last_role", "system"),
            "last_message_preview": str(row.get("last_text", ""))[:180],
        }
        for row in rows
    ]


async def list_recent_events(
    db: AsyncIOMotorDatabase,
    source: str | None,
    limit: int,
    child_ids: list[str] | None = None,
    since: datetime | None = None,
) -> list[dict]:
    query: dict = {}
    if source:
        query["source"] = source

    if child_ids is not None:
        if not child_ids:
            return []
        query["child_id"] = {"$in": child_ids}

    if since is not None:
        query["detected_at"] = {"$gte": _normalize_utc(since)}

    docs = await db.emotion_events.find(query).sort("detected_at", -1).limit(limit).to_list(length=limit)
    return [_serialize_id(doc) for doc in docs]


async def list_recent_logs(
    db: AsyncIOMotorDatabase,
    source: str | None,
    limit: int,
    level: str | None = None,
    session_id: str | None = None,
    child_ids: list[str] | None = None,
    since: datetime | None = None,
) -> list[dict]:
    query: dict = {}
    if source:
        query["source"] = source
    if level:
        query["level"] = level
    if session_id:
        query["session_id"] = session_id

    if child_ids is not None:
        if not child_ids:
            return []
        query["child_id"] = {"$in": child_ids}

    if since is not None:
        query["created_at"] = {"$gte": _normalize_utc(since)}

    docs = await db.system_logs.find(query).sort("created_at", -1).limit(limit).to_list(length=limit)
    return [_serialize_id(doc) for doc in docs]


async def get_dashboard_summary(
    db: AsyncIOMotorDatabase,
    source: str | None,
    hours: int,
    child_ids: list[str] | None = None,
) -> DashboardSummaryOut:
    since = datetime.now(timezone.utc).replace(microsecond=0) - timedelta(hours=hours)

    filters: dict = {"detected_at": {"$gte": since}}
    if source:
        filters["source"] = source

    if child_ids is not None:
        if not child_ids:
            return DashboardSummaryOut(
                source=source,
                total_events=0,
                primary_emotion="None",
                avg_confidence=0.0,
                alert_events=0,
                window_hours=hours,
            )
        filters["child_id"] = {"$in": child_ids}

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

    if payload.include_chat:
        chat_endpoint = payload.chat_url or _derive_related_endpoint(payload.url, "chat")
        chat_params: dict[str, str] = {"source": payload.source, "limit": "500"}
        if payload.since:
            chat_params["since"] = _normalize_utc(payload.since).isoformat()

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                chat_response = await client.get(chat_endpoint, params=chat_params, headers=headers)
                chat_response.raise_for_status()
                chat_body = chat_response.json()

            if isinstance(chat_body, list):
                for item in chat_body:
                    if not isinstance(item, dict):
                        continue
                    if item.get("role") not in {"user", "zara", "system"}:
                        continue
                    created_at = _parse_iso_datetime(item.get("created_at"))
                    session_id = item.get("session_id")
                    text = item.get("text")
                    if not created_at or not session_id or not text:
                        continue
                    await db.chat_messages.update_one(
                        {
                            "source": payload.source,
                            "session_id": session_id,
                            "created_at": created_at,
                            "text": text,
                        },
                        {
                            "$setOnInsert": {
                                "source": payload.source,
                                "session_id": session_id,
                                "child_id": item.get("child_id"),
                                "user_id": item.get("user_id") or item.get("child_id"),
                                "role": item.get("role"),
                                "text": text,
                                "emotion": item.get("emotion"),
                                "created_at": created_at,
                            }
                        },
                        upsert=True,
                    )
        except Exception:
            pass

    if payload.include_logs:
        logs_endpoint = payload.logs_url or _derive_related_endpoint(payload.url, "logs")
        logs_params: dict[str, str] = {"source": payload.source, "limit": "500"}
        if payload.since:
            logs_params["since"] = _normalize_utc(payload.since).isoformat()

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                logs_response = await client.get(logs_endpoint, params=logs_params, headers=headers)
                logs_response.raise_for_status()
                logs_body = logs_response.json()

            if isinstance(logs_body, list):
                for item in logs_body:
                    if not isinstance(item, dict):
                        continue
                    log_created_at = _parse_iso_datetime(item.get("created_at"))
                    if not log_created_at:
                        continue
                    await db.system_logs.update_one(
                        {
                            "source": payload.source,
                            "category": item.get("category"),
                            "message": item.get("message"),
                            "created_at": log_created_at,
                        },
                        {
                            "$setOnInsert": {
                                "source": payload.source,
                                "level": item.get("level", "info"),
                                "category": item.get("category", "remote"),
                                "message": item.get("message", ""),
                                "child_id": item.get("child_id"),
                                "parent_id": item.get("parent_id"),
                                "user_id": item.get("user_id"),
                                "session_id": item.get("session_id"),
                                "context": item.get("context"),
                                "created_at": log_created_at,
                            }
                        },
                        upsert=True,
                    )
        except Exception:
            pass

    return SyncPullResponse(
        source=payload.source,
        fetched=len(normalized_events),
        inserted=inserted,
        updated=updated,
    )
