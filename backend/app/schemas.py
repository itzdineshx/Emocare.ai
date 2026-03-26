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


class EmotionEventIn(BaseModel):
    source: str = Field(min_length=1, max_length=120)
    external_id: Optional[str] = Field(default=None, max_length=120)
    idempotency_key: Optional[str] = Field(default=None, max_length=120)

    child_id: Optional[str] = Field(default=None, max_length=120)
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
    external_id: Optional[str]
    idempotency_key: Optional[str]
    child_id: Optional[str]
    session_id: Optional[str]
    emotion: str
    confidence: float
    gesture: Optional[str]
    transcript: Optional[str]
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
    role: Literal["user", "zara", "system"]
    text: str = Field(min_length=1)
    emotion: Optional[EmotionName] = None


class ChatMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    source: str
    session_id: str
    role: str
    text: str
    emotion: Optional[str]
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


class SyncPullResponse(BaseModel):
    source: str
    fetched: int
    inserted: int
    updated: int
