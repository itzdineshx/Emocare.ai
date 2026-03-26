from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.mongo import get_database
from app.schemas import (
    ChatMessageIn,
    ChatMessageOut,
    DashboardSummaryOut,
    EmotionBulkIn,
    EmotionBulkResult,
    EmotionEventIn,
    EmotionEventOut,
    SyncPullRequest,
    SyncPullResponse,
)
from app.services.sync_service import (
    bulk_upsert_events,
    create_chat_message,
    get_dashboard_summary,
    list_chat_messages,
    list_recent_events,
    pull_and_sync_remote,
    upsert_emotion_event,
)

router = APIRouter(prefix="/api/v1", tags=["sync"])


@router.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/events", response_model=EmotionEventOut)
async def ingest_event(payload: EmotionEventIn, db: AsyncIOMotorDatabase = Depends(get_database)) -> EmotionEventOut:
    event, _ = await upsert_emotion_event(db, payload)
    return EmotionEventOut.model_validate(event)


@router.post("/events/bulk", response_model=EmotionBulkResult)
async def ingest_events_bulk(payload: EmotionBulkIn, db: AsyncIOMotorDatabase = Depends(get_database)) -> EmotionBulkResult:
    normalized: list[EmotionEventIn] = []
    for event in payload.events:
        event_data = event.model_dump()
        event_data["source"] = payload.source
        normalized.append(EmotionEventIn.model_validate(event_data))

    inserted, updated = await bulk_upsert_events(db, normalized)
    return EmotionBulkResult(
        source=payload.source,
        inserted=inserted,
        updated=updated,
        total_processed=len(normalized),
    )


@router.get("/events/recent", response_model=list[EmotionEventOut])
async def get_recent_events(
    source: str | None = None,
    limit: int = Query(default=50, ge=1, le=300),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> list[EmotionEventOut]:
    events = await list_recent_events(db, source=source, limit=limit)
    return [EmotionEventOut.model_validate(event) for event in events]


@router.get("/dashboard/summary", response_model=DashboardSummaryOut)
async def dashboard_summary(
    source: str | None = None,
    hours: int = Query(default=24, ge=1, le=168),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> DashboardSummaryOut:
    return await get_dashboard_summary(db, source=source, hours=hours)


@router.post("/chat/messages", response_model=ChatMessageOut)
async def create_message(payload: ChatMessageIn, db: AsyncIOMotorDatabase = Depends(get_database)) -> ChatMessageOut:
    message = await create_chat_message(db, payload)
    return ChatMessageOut.model_validate(message)


@router.get("/chat/messages", response_model=list[ChatMessageOut])
async def get_messages(
    source: str,
    session_id: str,
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> list[ChatMessageOut]:
    messages = await list_chat_messages(db, source=source, session_id=session_id, limit=limit)
    return [ChatMessageOut.model_validate(message) for message in messages]


@router.post("/sync/pull", response_model=SyncPullResponse)
async def sync_pull(payload: SyncPullRequest, db: AsyncIOMotorDatabase = Depends(get_database)) -> SyncPullResponse:
    try:
        result = await pull_and_sync_remote(db, payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Sync failed: {exc}") from exc

    return result
