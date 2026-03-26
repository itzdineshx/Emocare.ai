<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/946c90d0-edda-4c10-ae4f-2b6d493a5f5c

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set `VITE_OPENROUTER_API_KEY` in `.env.local`.
3. Optionally set `VITE_OPENROUTER_MODEL` to a Gemini model on OpenRouter (default is `google/gemini-2.0-flash-lite-001`).
4. Optionally set `VITE_OPENROUTER_MIN_INTERVAL_MS` to throttle calls for low rate limits.
5. Run the app:
   `npm run dev`

## Backend (FastAPI)

This repository now includes a sync backend under `backend/` for multi-dashboard API and DB synchronization.

Quick start:

1. `cd backend`
2. `pip install -r requirements.txt`
3. Copy `.env.example` to `.env`
4. `uvicorn app.main:app --reload --port 8000`

See `backend/README.md` for endpoint details.

## Frontend API Config

Set these in your frontend `.env` so each dashboard can use the shared backend:

- `VITE_API_BASE_URL=http://localhost:8000/api/v1`
- `VITE_DASHBOARD_SOURCE=dashboard-web`

Use a different `VITE_DASHBOARD_SOURCE` per dashboard instance (for example `dashboard-a` and `dashboard-b`).
