from fastapi import APIRouter, Depends, HTTPException, Query
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
    CreateChildIn,
    DashboardSummaryOut,
    EmotionBulkIn,
    EmotionBulkResult,
    EmotionEventIn,
    EmotionEventOut,
    LoginIn,
    RegisterParentIn,
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
    user = await authenticate_user(db, email=payload.email, password=payload.password)
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
            email=payload.email,
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
    return ChatMessageOut.model_validate(message)


@router.get("/chat/messages", response_model=list[ChatMessageOut])
async def get_messages(
    source: str,
    session_id: str,
    child_id: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict | None = Depends(get_current_user_optional),
) -> list[ChatMessageOut]:
    _, child_scope_ids = await resolve_child_scope(db, current_user, child_id)
    messages = await list_chat_messages(db, source=source, session_id=session_id, limit=limit, child_ids=child_scope_ids)
    return [ChatMessageOut.model_validate(message) for message in messages]


@router.post("/sync/pull", response_model=SyncPullResponse)
async def sync_pull(
    payload: SyncPullRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_parent: dict = Depends(require_parent_user),
) -> SyncPullResponse:
    try:
        result = await pull_and_sync_remote(db, payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Sync failed: {exc}") from exc

    return result
