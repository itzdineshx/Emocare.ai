from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import (
    get_current_user_optional,
    get_current_user_required,
    require_parent_user,
    resolve_child_scope,
)
from app.core.security import create_access_token
from app.db.mongo import get_database
from app.schemas import (
    AuthTokenOut,
    ChatMessageIn,
    ChatMessageOut,
    ConversationThreadOut,
    CreateChildIn,
    DashboardSummaryOut,
    EmotionBulkIn,
    EmotionBulkResult,
    EmotionEventIn,
    EmotionEventOut,
    LiveStreamPacketIn,
    LiveStreamPacketOut,
    LoginIn,
    RegisterParentIn,
    SystemLogIn,
    SystemLogOut,
    SyncPullRequest,
    SyncPullResponse,
    UserOut,
)
from app.services.auth_service import (
    authenticate_user,
    create_child_account,
    list_children_for_parent,
    register_parent,
)
from app.services.sync_service import (
    bulk_upsert_events,
    create_live_stream_packet,
    create_chat_message,
    create_system_log,
    get_dashboard_summary,
    list_conversation_threads,
    list_chat_messages,
    list_recent_logs,
    list_recent_events,
    list_recent_stream_packets,
    pull_and_sync_remote,
    upsert_emotion_event,
)
from app.services.realtime_stream import realtime_stream_hub

router = APIRouter(prefix="/api/v1", tags=["sync"])


@router.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.websocket("/stream/ws/{source}")
async def stream_websocket(source: str, websocket: WebSocket) -> None:
    await realtime_stream_hub.connect(source, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "ping":
                await websocket.send_json(realtime_stream_hub.heartbeat_payload(source))
    except WebSocketDisconnect:
        await realtime_stream_hub.disconnect(source, websocket)
    except Exception:
        await realtime_stream_hub.disconnect(source, websocket)


@router.post("/stream/publish", response_model=LiveStreamPacketOut, tags=["stream"])
async def stream_publish(
    payload: LiveStreamPacketIn,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict | None = Depends(get_current_user_optional),
) -> LiveStreamPacketOut:
    if current_user:
        role = current_user.get("role")
        if role == "child":
            payload.child_id = current_user.get("user_id")
            payload.parent_id = current_user.get("parent_id")
            payload.user_id = current_user.get("user_id")
        elif role == "parent":
            resolved_child_id, _ = await resolve_child_scope(db, current_user, payload.child_id)
            payload.child_id = resolved_child_id
            payload.parent_id = current_user.get("user_id")
            payload.user_id = current_user.get("user_id")

    packet = await create_live_stream_packet(db, payload)
    await realtime_stream_hub.broadcast(
        payload.source,
        {
            "type": "stream.packet",
            "stream_type": payload.stream_type,
            "payload": packet,
        },
    )
    return LiveStreamPacketOut.model_validate(packet)


@router.get("/stream/recent", response_model=list[LiveStreamPacketOut], tags=["stream"])
async def stream_recent(
    source: str | None = None,
    stream_type: str | None = Query(default=None, pattern="^(camera|voice|emotion)$"),
    child_id: str | None = None,
    since: datetime | None = None,
    limit: int = Query(default=200, ge=1, le=1000),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict | None = Depends(get_current_user_optional),
) -> list[LiveStreamPacketOut]:
    parent_scope_id: str | None = None
    if current_user and current_user.get("role") == "parent":
        parent_scope_id = current_user.get("user_id")

    _, child_scope_ids = await resolve_child_scope(db, current_user, child_id)
    rows = await list_recent_stream_packets(
        db,
        source=source,
        stream_type=stream_type,
        limit=limit,
        child_ids=child_scope_ids,
        parent_id=parent_scope_id,
        since=since,
    )
    return [LiveStreamPacketOut.model_validate(row) for row in rows]


@router.post("/auth/register/parent", response_model=UserOut, tags=["auth"])
async def auth_register_parent(payload: RegisterParentIn, db: AsyncIOMotorDatabase = Depends(get_database)) -> UserOut:
    try:
        user = await register_parent(
            db,
            name=payload.name,
            email=payload.email,
            password=payload.password,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return UserOut.model_validate(user)


@router.post("/auth/login", response_model=AuthTokenOut, tags=["auth"])
async def auth_login(payload: LoginIn, db: AsyncIOMotorDatabase = Depends(get_database)) -> AuthTokenOut:
    if not payload.email and not payload.username:
        raise HTTPException(status_code=400, detail="Provide email or username")

    if payload.username and not payload.parent_id:
        raise HTTPException(status_code=400, detail="Parent ID is required for child username login")

    user = await authenticate_user(
        db,
        email=payload.email,
        username=payload.username,
        parent_id=payload.parent_id,
        password=payload.password,
        parent_email=payload.parent_email,
    )
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({
        "sub": user["user_id"],
        "role": user["role"],
        "email": user["email"],
    })
    return AuthTokenOut(access_token=token, user=UserOut.model_validate(user))


@router.get("/auth/me", response_model=UserOut, tags=["auth"])
async def auth_me(current_user: dict = Depends(get_current_user_required)) -> UserOut:
    return UserOut.model_validate(current_user)


@router.post("/auth/children", response_model=UserOut, tags=["auth"])
async def auth_create_child(
    payload: CreateChildIn,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_parent: dict = Depends(require_parent_user),
) -> UserOut:
    try:
        child = await create_child_account(
            db,
            parent_user_id=current_parent["user_id"],
            name=payload.name,
            username=payload.username,
            email=payload.email,
            age=payload.age,
            grade=payload.grade,
            interests=payload.interests,
            password=payload.password,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return UserOut.model_validate(child)


@router.get("/auth/children", response_model=list[UserOut], tags=["auth"])
async def auth_list_children(
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_parent: dict = Depends(require_parent_user),
) -> list[UserOut]:
    children = await list_children_for_parent(db, current_parent["user_id"])
    return [UserOut.model_validate(child) for child in children]


@router.post("/events", response_model=EmotionEventOut)
async def ingest_event(
    payload: EmotionEventIn,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict | None = Depends(get_current_user_optional),
) -> EmotionEventOut:
    if current_user:
        role = current_user.get("role")
        user_id = current_user.get("user_id")
        if role == "child":
            payload.child_id = user_id
            payload.user_id = user_id
            payload.parent_id = current_user.get("parent_id")
        elif role == "parent":
            resolved_child_id, _ = await resolve_child_scope(db, current_user, payload.child_id)
            payload.child_id = resolved_child_id
            payload.user_id = user_id
            payload.parent_id = user_id

    event, _ = await upsert_emotion_event(db, payload)
    await realtime_stream_hub.broadcast(
        payload.source,
        {
            "type": "emotion.update",
            "payload": event,
        },
    )
    if current_user:
        await create_system_log(
            db,
            SystemLogIn(
                source=payload.source,
                level="info",
                category="emotion_event",
                message=f"Emotion event ingested ({payload.emotion})",
                child_id=payload.child_id,
                parent_id=payload.parent_id,
                user_id=payload.user_id,
                session_id=payload.session_id,
                context={"confidence": payload.confidence},
            ),
        )
    return EmotionEventOut.model_validate(event)


@router.post("/events/bulk", response_model=EmotionBulkResult)
async def ingest_events_bulk(
    payload: EmotionBulkIn,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict | None = Depends(get_current_user_optional),
) -> EmotionBulkResult:
    normalized: list[EmotionEventIn] = []
    for event in payload.events:
        event_data = event.model_dump()
        event_data["source"] = payload.source

        if current_user:
            role = current_user.get("role")
            user_id = current_user.get("user_id")
            if role == "child":
                event_data["child_id"] = user_id
                event_data["user_id"] = user_id
                event_data["parent_id"] = current_user.get("parent_id")
            elif role == "parent":
                requested_child_id = event_data.get("child_id")
                resolved_child_id, _ = await resolve_child_scope(db, current_user, requested_child_id)
                event_data["child_id"] = resolved_child_id
                event_data["user_id"] = user_id
                event_data["parent_id"] = user_id

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
    child_id: str | None = None,
    limit: int = Query(default=50, ge=1, le=300),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict | None = Depends(get_current_user_optional),
) -> list[EmotionEventOut]:
    _, child_scope_ids = await resolve_child_scope(db, current_user, child_id)
    events = await list_recent_events(db, source=source, limit=limit, child_ids=child_scope_ids)
    return [EmotionEventOut.model_validate(event) for event in events]


@router.get("/dashboard/summary", response_model=DashboardSummaryOut)
async def dashboard_summary(
    source: str | None = None,
    child_id: str | None = None,
    hours: int = Query(default=24, ge=1, le=168),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict | None = Depends(get_current_user_optional),
) -> DashboardSummaryOut:
    _, child_scope_ids = await resolve_child_scope(db, current_user, child_id)
    return await get_dashboard_summary(db, source=source, hours=hours, child_ids=child_scope_ids)


@router.post("/chat/messages", response_model=ChatMessageOut)
async def create_message(
    payload: ChatMessageIn,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict | None = Depends(get_current_user_optional),
) -> ChatMessageOut:
    if current_user:
        role = current_user.get("role")
        if role == "child":
            payload.child_id = current_user.get("user_id")
        elif role == "parent":
            resolved_child_id, _ = await resolve_child_scope(db, current_user, payload.child_id)
            payload.child_id = resolved_child_id

    message = await create_chat_message(db, payload)
    await realtime_stream_hub.broadcast(
        payload.source,
        {
            "type": "voice.update",
            "payload": message,
        },
    )
    if current_user:
        await create_system_log(
            db,
            SystemLogIn(
                source=payload.source,
                level="info",
                category="chat_message",
                message=f"Chat message stored ({payload.role})",
                child_id=payload.child_id,
                parent_id=current_user.get("user_id") if current_user.get("role") == "parent" else current_user.get("parent_id"),
                user_id=current_user.get("user_id"),
                session_id=payload.session_id,
                context={"text_length": len(payload.text)},
            ),
        )
    return ChatMessageOut.model_validate(message)


@router.get("/chat/messages", response_model=list[ChatMessageOut])
async def get_messages(
    source: str,
    session_id: str,
    child_id: str | None = None,
    since: datetime | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict | None = Depends(get_current_user_optional),
) -> list[ChatMessageOut]:
    _, child_scope_ids = await resolve_child_scope(db, current_user, child_id)
    messages = await list_chat_messages(
        db,
        source=source,
        session_id=session_id,
        limit=limit,
        child_ids=child_scope_ids,
        since=since,
    )
    return [ChatMessageOut.model_validate(message) for message in messages]


@router.get("/chat/conversations", response_model=list[ConversationThreadOut])
async def get_conversations(
    source: str | None = None,
    child_id: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict | None = Depends(get_current_user_optional),
) -> list[ConversationThreadOut]:
    _, child_scope_ids = await resolve_child_scope(db, current_user, child_id)
    rows = await list_conversation_threads(db, source=source, limit=limit, child_ids=child_scope_ids)
    return [ConversationThreadOut.model_validate(row) for row in rows]


@router.post("/logs", response_model=SystemLogOut)
async def create_log(
    payload: SystemLogIn,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict | None = Depends(get_current_user_optional),
) -> SystemLogOut:
    if current_user:
        role = current_user.get("role")
        if role == "child":
            payload.child_id = current_user.get("user_id")
            payload.parent_id = current_user.get("parent_id")
            payload.user_id = current_user.get("user_id")
        elif role == "parent":
            resolved_child_id, _ = await resolve_child_scope(db, current_user, payload.child_id)
            payload.child_id = resolved_child_id
            payload.parent_id = current_user.get("user_id")
            payload.user_id = current_user.get("user_id")

    log_doc = await create_system_log(db, payload)
    await realtime_stream_hub.broadcast(
        payload.source,
        {
            "type": "log.update",
            "payload": log_doc,
        },
    )
    return SystemLogOut.model_validate(log_doc)


@router.get("/logs/recent", response_model=list[SystemLogOut])
async def get_logs(
    source: str | None = None,
    child_id: str | None = None,
    level: str | None = None,
    session_id: str | None = None,
    since: datetime | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict | None = Depends(get_current_user_optional),
) -> list[SystemLogOut]:
    _, child_scope_ids = await resolve_child_scope(db, current_user, child_id)
    logs = await list_recent_logs(
        db,
        source=source,
        limit=limit,
        level=level,
        session_id=session_id,
        child_ids=child_scope_ids,
        since=since,
    )
    return [SystemLogOut.model_validate(log) for log in logs]


@router.get("/sync/export/events", response_model=list[EmotionEventOut], tags=["sync"])
async def sync_export_events(
    source: str | None = None,
    child_id: str | None = None,
    since: datetime | None = None,
    limit: int = Query(default=500, ge=1, le=2000),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict | None = Depends(get_current_user_optional),
) -> list[EmotionEventOut]:
    _, child_scope_ids = await resolve_child_scope(db, current_user, child_id)
    events = await list_recent_events(db, source=source, limit=limit, child_ids=child_scope_ids, since=since)
    return [EmotionEventOut.model_validate(event) for event in events]


@router.get("/sync/export/chat", response_model=list[ChatMessageOut], tags=["sync"])
async def sync_export_chat(
    source: str,
    session_id: str | None = None,
    child_id: str | None = None,
    since: datetime | None = None,
    limit: int = Query(default=500, ge=1, le=2000),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict | None = Depends(get_current_user_optional),
) -> list[ChatMessageOut]:
    _, child_scope_ids = await resolve_child_scope(db, current_user, child_id)
    messages = await list_chat_messages(
        db,
        source=source,
        session_id=session_id,
        limit=limit,
        child_ids=child_scope_ids,
        since=since,
    )
    return [ChatMessageOut.model_validate(message) for message in messages]


@router.get("/sync/export/logs", response_model=list[SystemLogOut], tags=["sync"])
async def sync_export_logs(
    source: str | None = None,
    child_id: str | None = None,
    level: str | None = None,
    since: datetime | None = None,
    limit: int = Query(default=500, ge=1, le=2000),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict | None = Depends(get_current_user_optional),
) -> list[SystemLogOut]:
    _, child_scope_ids = await resolve_child_scope(db, current_user, child_id)
    logs = await list_recent_logs(
        db,
        source=source,
        limit=limit,
        level=level,
        session_id=None,
        child_ids=child_scope_ids,
        since=since,
    )
    return [SystemLogOut.model_validate(log) for log in logs]


@router.post("/sync/pull", response_model=SyncPullResponse)
async def sync_pull(
    payload: SyncPullRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_parent: dict = Depends(require_parent_user),
) -> SyncPullResponse:
    try:
        result = await pull_and_sync_remote(db, payload)
        await create_system_log(
            db,
            SystemLogIn(
                source=payload.source,
                level="info",
                category="sync_pull",
                message="Remote sync pull completed",
                parent_id=current_parent.get("user_id"),
                user_id=current_parent.get("user_id"),
                context={
                    "fetched": result.fetched,
                    "inserted": result.inserted,
                    "updated": result.updated,
                    "include_chat": payload.include_chat,
                    "include_logs": payload.include_logs,
                },
            ),
        )
    except Exception as exc:
        await create_system_log(
            db,
            SystemLogIn(
                source=payload.source,
                level="error",
                category="sync_pull",
                message=f"Remote sync pull failed: {exc}",
                parent_id=current_parent.get("user_id"),
                user_id=current_parent.get("user_id"),
            ),
        )
        raise HTTPException(status_code=400, detail=f"Sync failed: {exc}") from exc

    return result
