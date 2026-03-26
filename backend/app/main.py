from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import get_settings
from app.db.base import init_db
from app.db.mongo import get_database_client
from app.schemas import SyncPullRequest
from app.services.sync_service import pull_and_sync_remote

settings = get_settings()


async def _auto_sync_loop(stop_event: asyncio.Event) -> None:
    while not stop_event.is_set():
        if settings.auto_sync_source and settings.auto_sync_url:
            try:
                payload = SyncPullRequest(
                    source=settings.auto_sync_source,
                    url=settings.auto_sync_url,
                    api_key=settings.auto_sync_api_key or None,
                )
                db = get_database_client()
                await pull_and_sync_remote(db, payload)
            except Exception:
                # Keep the service available even if one sync attempt fails.
                pass

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=settings.sync_poll_interval_seconds)
        except TimeoutError:
            continue


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()

    stop_event = asyncio.Event()
    auto_sync_task = asyncio.create_task(_auto_sync_loop(stop_event))

    app.state.sync_stop_event = stop_event
    app.state.auto_sync_task = auto_sync_task

    yield

    stop_event.set()
    await auto_sync_task


app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.parsed_cors_origins,
    allow_origin_regex=settings.cors_origin_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
