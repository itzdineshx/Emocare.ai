# Deployment Guide (Vercel + Render)

## 1) Backend on Render (FastAPI)

1. Push your code to GitHub.
2. In Render, click New -> Web Service.
3. Connect the repository.
4. Configure service:
- Root Directory: backend
- Environment: Python
- Build Command: pip install -r requirements.txt
- Start Command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
5. Add environment variables from backend/.env.render.example.
6. Deploy and copy your backend URL, for example:
- https://emocare-api.onrender.com
7. Test health endpoint:
- https://emocare-api.onrender.com/api/v1/health

## 2) Frontend on Vercel (React + Vite)

1. In Vercel, click Add New -> Project.
2. Import the same GitHub repository.
3. Configure project:
- Framework Preset: Vite
- Root Directory: .
- Build Command: npm run build
- Output Directory: dist
4. Add environment variables from .env.vercel.example.
5. Ensure VITE_API_BASE_URL uses your Render URL with /api/v1.
6. Deploy.

## 3) CORS and Sync Check

1. Set backend CORS_ORIGINS to your Vercel production URL.
2. Redeploy backend if CORS was changed.
3. Open the Vercel frontend and verify:
- Dashboard loads data from backend
- Live Monitor writes events
- AI Companion reads and writes chat

## 4) Production Tips

1. Use separate values per environment:
- dashboard-vercel-prod
- dashboard-vercel-preview
2. Keep OPENROUTER key secret in Vercel env, never commit to git.
3. If Render sleeps on free tier, first request can be slow.
4. Rotate any exposed MongoDB credentials immediately.

## 5) Mother-Child Dashboard Sync

Use this when two dashboards run on separate frontends/backends but should share data.

Child backend (Render) env:

- `CORS_ORIGINS=https://emocare-child.vercel.app,https://emocare-mother.vercel.app`
- `AUTO_SYNC_SOURCE=dashboard-mother`
- `AUTO_SYNC_URL=https://emocare-mother-backend.onrender.com/api/v1/events/recent?source=dashboard-mother&limit=300`
- `SYNC_POLL_INTERVAL_SECONDS=30`

Child frontend (Vercel) env:

- `VITE_API_BASE_URL=https://emocare-child-backend.onrender.com`
- `VITE_DASHBOARD_SOURCE=dashboard-child`

Mother frontend should use:

- `VITE_DASHBOARD_SOURCE=dashboard-mother`

Notes:

1. Use distinct dashboard sources to avoid collisions.
2. If you want two-way replication, configure the mother backend with corresponding pull-sync settings that point to the child backend.
3. Best long-term architecture is a single shared backend/database used by both frontends.
