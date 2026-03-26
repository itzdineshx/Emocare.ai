from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

EmotionName = Literal[
    "Happy",
    "Sad",
    "Angry",
    "Neutral",
    "Surprised",
    "Fearful",
    "Disgusted",
]

UserRole = Literal["parent", "child"]


class RegisterParentIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=128)


class CreateChildIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    username: str = Field(min_length=3, max_length=60)
    email: Optional[str] = Field(default=None, min_length=3, max_length=320)
    age: Optional[int] = Field(default=None, ge=1, le=18)
    grade: Optional[str] = Field(default=None, min_length=1, max_length=40)
    interests: list[str] = Field(default_factory=list)
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    email: Optional[str] = Field(default=None, min_length=3, max_length=320)
    username: Optional[str] = Field(default=None, min_length=3, max_length=60)
    parent_id: Optional[str] = Field(default=None, min_length=3, max_length=120)
    password: str = Field(min_length=8, max_length=128)
    parent_email: Optional[str] = Field(default=None, min_length=3, max_length=320)


class UserOut(BaseModel):
    id: str
    user_id: str
    name: str
    email: str
    role: UserRole
    parent_id: Optional[str] = None
    username: Optional[str] = None
    age: Optional[int] = None
    grade: Optional[str] = None
    interests: list[str] = Field(default_factory=list)
    created_at: datetime


class AuthTokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class EmotionEventIn(BaseModel):
    source: str = Field(min_length=1, max_length=120)
    external_id: Optional[str] = Field(default=None, max_length=120)
    idempotency_key: Optional[str] = Field(default=None, max_length=120)

    child_id: Optional[str] = Field(default=None, max_length=120)
    parent_id: Optional[str] = Field(default=None, max_length=120)
    user_id: Optional[str] = Field(default=None, max_length=120)
    session_id: Optional[str] = Field(default=None, max_length=120)
    emotion: EmotionName
    confidence: float = Field(ge=0, le=100)
    gesture: Optional[str] = Field(default=None, max_length=120)
    transcript: Optional[str] = None
    detected_at: datetime


class EmotionEventBulkItem(BaseModel):
    external_id: Optional[str] = Field(default=None, max_length=120)
    idempotency_key: Optional[str] = Field(default=None, max_length=120)

    child_id: Optional[str] = Field(default=None, max_length=120)
    parent_id: Optional[str] = Field(default=None, max_length=120)
    user_id: Optional[str] = Field(default=None, max_length=120)
    session_id: Optional[str] = Field(default=None, max_length=120)
    emotion: EmotionName
    confidence: float = Field(ge=0, le=100)
    gesture: Optional[str] = Field(default=None, max_length=120)
    transcript: Optional[str] = None
    detected_at: datetime


class EmotionEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    source: str
    external_id: Optional[str] = None
    idempotency_key: Optional[str] = None
    child_id: Optional[str] = None
    parent_id: Optional[str] = None
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    emotion: str
    confidence: float
    gesture: Optional[str] = None
    transcript: Optional[str] = None
    detected_at: datetime
    created_at: datetime


class EmotionBulkIn(BaseModel):
    source: str = Field(min_length=1, max_length=120)
    events: list[EmotionEventBulkItem]


class EmotionBulkResult(BaseModel):
    source: str
    inserted: int
    updated: int
    total_processed: int


class ChatMessageIn(BaseModel):
    source: str = Field(min_length=1, max_length=120)
    session_id: str = Field(min_length=1, max_length=120)
    child_id: Optional[str] = Field(default=None, max_length=120)
    role: Literal["user", "zara", "system"]
    text: str = Field(min_length=1)
    emotion: Optional[EmotionName] = None


class ChatMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    source: str
    session_id: str
    child_id: Optional[str] = None
    user_id: Optional[str] = None
    role: str
    text: str
    emotion: Optional[str] = None
    created_at: datetime


class ConversationThreadOut(BaseModel):
    source: str
    session_id: str
    child_id: Optional[str] = None
    total_messages: int
    last_message_at: datetime
    last_role: str
    last_message_preview: str


class SystemLogIn(BaseModel):
    source: str = Field(min_length=1, max_length=120)
    level: Literal["debug", "info", "warning", "error"] = "info"
    category: str = Field(default="system", min_length=1, max_length=120)
    message: str = Field(min_length=1, max_length=2000)
    child_id: Optional[str] = Field(default=None, max_length=120)
    parent_id: Optional[str] = Field(default=None, max_length=120)
    user_id: Optional[str] = Field(default=None, max_length=120)
    session_id: Optional[str] = Field(default=None, max_length=120)
    context: Optional[dict] = None


class SystemLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    source: str
    level: str
    category: str
    message: str
    child_id: Optional[str] = None
    parent_id: Optional[str] = None
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    context: Optional[dict] = None
    created_at: datetime


class DashboardSummaryOut(BaseModel):
    source: Optional[str]
    total_events: int
    primary_emotion: str
    avg_confidence: float
    alert_events: int
    window_hours: int


class SyncPullRequest(BaseModel):
    source: str = Field(min_length=1, max_length=120)
    url: str = Field(min_length=1)
    api_key: Optional[str] = None
    since: Optional[datetime] = None
    include_chat: bool = False
    include_logs: bool = False
    chat_url: Optional[str] = None
    logs_url: Optional[str] = None


class SyncPullResponse(BaseModel):
    source: str
    fetched: int
    inserted: int
    updated: int
