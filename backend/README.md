# EmoCare FastAPI Backend

This backend gives both dashboards a shared API and database so they stay synchronized.

## Features

- FastAPI async APIs for event ingest, chat history, and dashboard summary.
- Async MongoDB (Motor) with idempotent upsert support.
- Bulk ingestion endpoint for high-throughput sync.
- Pull-sync endpoint to fetch events from another dashboard backend.
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
- For inbound sync from another backend, call `POST /api/v1/sync/pull` with a source URL that returns either:
  - A list of event objects
  - Or `{ "events": [...] }`

## Notes

- Default database is MongoDB.
- For production, use a managed MongoDB cluster and set `MONGODB_URL` and `MONGODB_DB_NAME` in `.env`.
