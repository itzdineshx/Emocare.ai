const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:8000/api/v1';
const DASHBOARD_SOURCE = (import.meta.env.VITE_DASHBOARD_SOURCE as string | undefined) || 'dashboard-web';

export interface EmotionEventPayload {
  source: string;
  external_id?: string;
  idempotency_key?: string;
  child_id?: string;
  session_id?: string;
  emotion: string;
  confidence: number;
  gesture?: string;
  transcript?: string;
  detected_at: string;
}

export interface EmotionEventRecord {
  id: string;
  source: string;
  external_id?: string | null;
  idempotency_key?: string | null;
  child_id?: string | null;
  session_id?: string | null;
  emotion: string;
  confidence: number;
  gesture?: string | null;
  transcript?: string | null;
  detected_at: string;
  created_at: string;
}

export interface DashboardSummary {
  source?: string;
  total_events: number;
  primary_emotion: string;
  avg_confidence: number;
  alert_events: number;
  window_hours: number;
}

export interface ChatMessageRecord {
  id: string;
  source: string;
  session_id: string;
  role: 'user' | 'zara' | 'system';
  text: string;
  emotion?: string | null;
  created_at: string;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API ${response.status}: ${body || response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export function getBackendSource(): string {
  return DASHBOARD_SOURCE;
}

export async function createEmotionEvent(payload: EmotionEventPayload): Promise<EmotionEventRecord> {
  const response = await fetch(`${API_BASE}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<EmotionEventRecord>(response);
}

export async function getRecentEvents(limit: number, source?: string): Promise<EmotionEventRecord[]> {
  const search = new URLSearchParams({ limit: String(limit) });
  if (source) {
    search.set('source', source);
  }

  const response = await fetch(`${API_BASE}/events/recent?${search.toString()}`);
  return parseJsonResponse<EmotionEventRecord[]>(response);
}

export async function getDashboardSummary(hours = 24, source?: string): Promise<DashboardSummary> {
  const search = new URLSearchParams({ hours: String(hours) });
  if (source) {
    search.set('source', source);
  }

  const response = await fetch(`${API_BASE}/dashboard/summary?${search.toString()}`);
  return parseJsonResponse<DashboardSummary>(response);
}

export async function createChatMessage(payload: {
  source: string;
  session_id: string;
  role: 'user' | 'zara' | 'system';
  text: string;
  emotion?: string;
}): Promise<ChatMessageRecord> {
  const response = await fetch(`${API_BASE}/chat/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<ChatMessageRecord>(response);
}

export async function getChatMessages(source: string, sessionId: string, limit = 100): Promise<ChatMessageRecord[]> {
  const search = new URLSearchParams({
    source,
    session_id: sessionId,
    limit: String(limit),
  });

  const response = await fetch(`${API_BASE}/chat/messages?${search.toString()}`);
  return parseJsonResponse<ChatMessageRecord[]>(response);
}
