# EmoCare FastAPI Backend

This backend gives both dashboards a shared API and database so they stay synchronized.

## Features

- FastAPI async APIs for event ingest, chat history, conversation threads, system logs, and dashboard summary.
- Async MongoDB (Motor) with idempotent upsert support.
- Bulk ingestion endpoint for high-throughput sync.
- Pull-sync endpoint to fetch events (and optionally chat/logs) from another dashboard backend.
- Optional automatic background sync loop.

## Setup

1. Create a virtual environment.
2. Install dependencies.
3. Copy `.env.example` to `.env` and update values.
4. Run the API server.

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

## API Overview

- `GET /api/v1/health`
- `POST /api/v1/events`
- `POST /api/v1/events/bulk`
- `GET /api/v1/events/recent?source=dashboard-a&limit=50`
- `GET /api/v1/dashboard/summary?source=dashboard-a&hours=24`
- `POST /api/v1/chat/messages`
- `GET /api/v1/chat/messages?source=dashboard-a&session_id=session-1&limit=100`
- `GET /api/v1/chat/conversations?source=dashboard-a&limit=50`
- `POST /api/v1/logs`
- `GET /api/v1/logs/recent?source=dashboard-a&limit=100`
- `GET /api/v1/sync/export/events?source=dashboard-a&since=2026-03-27T00:00:00Z`
- `GET /api/v1/sync/export/chat?source=dashboard-a&since=2026-03-27T00:00:00Z`
- `GET /api/v1/sync/export/logs?source=dashboard-a&since=2026-03-27T00:00:00Z`
- `POST /api/v1/sync/pull`

## Example Bulk Ingest

```json
{
  "source": "dashboard-a",
  "events": [
    {
      "source": "dashboard-a",
      "external_id": "evt-1001",
      "idempotency_key": "evt-1001",
      "child_id": "child-1",
      "session_id": "session-42",
      "emotion": "Happy",
      "confidence": 96,
      "gesture": "Waving",
      "transcript": "I am happy",
      "detected_at": "2026-03-27T09:12:00Z"
    }
  ]
}
```

## Synchronization Strategy

- Both dashboards post events to this API using unique `source` values.
- Use `external_id` or `idempotency_key` for deduplication during retries.
- For inbound sync from another backend, call `POST /api/v1/sync/pull` with a URL pointing to the other dashboard export endpoint (recommended: `/api/v1/sync/export/events`).
- You can include chat and logs in the same pull request:

```json
{
  "source": "mother-dashboard",
  "url": "https://other-dashboard.example.com/api/v1/sync/export/events",
  "api_key": "optional-token",
  "since": "2026-03-27T00:00:00Z",
  "include_chat": true,
  "include_logs": true,
  "chat_url": "https://other-dashboard.example.com/api/v1/sync/export/chat",
  "logs_url": "https://other-dashboard.example.com/api/v1/sync/export/logs"
}
```

## Notes

- Default database is MongoDB.
- For production, use a managed MongoDB cluster and set `MONGODB_URL` and `MONGODB_DB_NAME` in `.env`.
