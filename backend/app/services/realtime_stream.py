from __future__ import annotations

import asyncio
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import WebSocket


class RealtimeStreamHub:
    def __init__(self) -> None:
        self._channels: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, channel: str, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._channels[channel].add(websocket)

    async def disconnect(self, channel: str, websocket: WebSocket) -> None:
        async with self._lock:
            if channel in self._channels:
                self._channels[channel].discard(websocket)
                if not self._channels[channel]:
                    self._channels.pop(channel, None)

    async def broadcast(self, channel: str, message: dict) -> None:
        async with self._lock:
            sockets = list(self._channels.get(channel, set()))

        if not sockets:
            return

        dead: list[WebSocket] = []
        for socket in sockets:
            try:
                await socket.send_json(message)
            except Exception:
                dead.append(socket)

        if dead:
            async with self._lock:
                for socket in dead:
                    self._channels[channel].discard(socket)

    @staticmethod
    def heartbeat_payload(channel: str) -> dict:
        return {
            "type": "heartbeat",
            "channel": channel,
            "ts": datetime.now(timezone.utc).isoformat(),
        }


realtime_stream_hub = RealtimeStreamHub()
