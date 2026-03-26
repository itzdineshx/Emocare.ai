const RAW_API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:8000/api/v1';
const AUTH_TOKEN_KEY = 'emocare-access-token';

function normalizeApiBase(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (trimmed.endsWith('/api/v1')) {
    return trimmed;
  }
  return `${trimmed}/api/v1`;
}

const API_BASE = normalizeApiBase(RAW_API_BASE);
const DASHBOARD_SOURCE = (import.meta.env.VITE_DASHBOARD_SOURCE as string | undefined) || 'dashboard-web';

export type UserRole = 'parent' | 'child';

export interface UserRecord {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: UserRole;
  parent_id?: string | null;
  created_at: string;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: 'bearer';
  user: UserRecord;
}

export interface EmotionEventPayload {
  source: string;
  external_id?: string;
  idempotency_key?: string;
  child_id?: string;
  parent_id?: string;
  user_id?: string;
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
  parent_id?: string | null;
  user_id?: string | null;
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
  child_id?: string | null;
  user_id?: string | null;
  role: 'user' | 'zara' | 'system';
  text: string;
  emotion?: string | null;
  created_at: string;
}

export interface ConversationThreadRecord {
  source: string;
  session_id: string;
  child_id?: string | null;
  total_messages: number;
  last_message_at: string;
  last_role: string;
  last_message_preview: string;
}

export interface SystemLogPayload {
  source: string;
  level?: 'debug' | 'info' | 'warning' | 'error';
  category?: string;
  message: string;
  child_id?: string;
  parent_id?: string;
  user_id?: string;
  session_id?: string;
  context?: Record<string, unknown>;
}

export interface SystemLogRecord {
  id: string;
  source: string;
  level: string;
  category: string;
  message: string;
  child_id?: string | null;
  parent_id?: string | null;
  user_id?: string | null;
  session_id?: string | null;
  context?: Record<string, unknown> | null;
  created_at: string;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API ${response.status}: ${body || response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

function buildAuthHeaders(baseHeaders: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken();
  if (!token) {
    return baseHeaders;
  }

  return {
    ...baseHeaders,
    Authorization: `Bearer ${token}`,
  };
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: buildAuthHeaders((options.headers as Record<string, string>) || {}),
  });
  return parseJsonResponse<T>(response);
}

export function getBackendSource(): string {
  return DASHBOARD_SOURCE;
}

export async function registerParent(payload: {
  name: string;
  email: string;
  password: string;
}): Promise<UserRecord> {
  return apiFetch<UserRecord>('/auth/register/parent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function login(payload: { email: string; password: string }): Promise<AuthTokenResponse> {
  return apiFetch<AuthTokenResponse>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getMe(): Promise<UserRecord> {
  return apiFetch<UserRecord>('/auth/me');
}

export async function createChild(payload: {
  name: string;
  email: string;
  password: string;
}): Promise<UserRecord> {
  return apiFetch<UserRecord>('/auth/children', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function listChildren(): Promise<UserRecord[]> {
  return apiFetch<UserRecord[]>('/auth/children');
}

export async function createEmotionEvent(payload: EmotionEventPayload): Promise<EmotionEventRecord> {
  return apiFetch<EmotionEventRecord>('/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getRecentEvents(limit: number, source?: string, childId?: string): Promise<EmotionEventRecord[]> {
  const search = new URLSearchParams({ limit: String(limit) });
  if (source) {
    search.set('source', source);
  }
  if (childId) {
    search.set('child_id', childId);
  }

  return apiFetch<EmotionEventRecord[]>(`/events/recent?${search.toString()}`);
}

export async function getDashboardSummary(hours = 24, source?: string, childId?: string): Promise<DashboardSummary> {
  const search = new URLSearchParams({ hours: String(hours) });
  if (source) {
    search.set('source', source);
  }
  if (childId) {
    search.set('child_id', childId);
  }

  return apiFetch<DashboardSummary>(`/dashboard/summary?${search.toString()}`);
}

export async function createChatMessage(payload: {
  source: string;
  session_id: string;
  child_id?: string;
  role: 'user' | 'zara' | 'system';
  text: string;
  emotion?: string;
}): Promise<ChatMessageRecord> {
  return apiFetch<ChatMessageRecord>('/chat/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getChatMessages(source: string, sessionId: string, limit = 100, childId?: string): Promise<ChatMessageRecord[]> {
  const search = new URLSearchParams({
    source,
    session_id: sessionId,
    limit: String(limit),
  });
  if (childId) {
    search.set('child_id', childId);
  }

  return apiFetch<ChatMessageRecord[]>(`/chat/messages?${search.toString()}`);
}

export async function getConversationThreads(limit = 50, source?: string, childId?: string): Promise<ConversationThreadRecord[]> {
  const search = new URLSearchParams({ limit: String(limit) });
  if (source) {
    search.set('source', source);
  }
  if (childId) {
    search.set('child_id', childId);
  }

  return apiFetch<ConversationThreadRecord[]>(`/chat/conversations?${search.toString()}`);
}

export async function createSystemLog(payload: SystemLogPayload): Promise<SystemLogRecord> {
  return apiFetch<SystemLogRecord>('/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getRecentLogs(params: {
  limit?: number;
  source?: string;
  childId?: string;
  level?: string;
  sessionId?: string;
  since?: string;
}): Promise<SystemLogRecord[]> {
  const search = new URLSearchParams({ limit: String(params.limit ?? 100) });
  if (params.source) {
    search.set('source', params.source);
  }
  if (params.childId) {
    search.set('child_id', params.childId);
  }
  if (params.level) {
    search.set('level', params.level);
  }
  if (params.sessionId) {
    search.set('session_id', params.sessionId);
  }
  if (params.since) {
    search.set('since', params.since);
  }

  return apiFetch<SystemLogRecord[]>(`/logs/recent?${search.toString()}`);
}

export async function exportEventsForSync(params: {
  limit?: number;
  source?: string;
  childId?: string;
  since?: string;
}): Promise<EmotionEventRecord[]> {
  const search = new URLSearchParams({ limit: String(params.limit ?? 500) });
  if (params.source) {
    search.set('source', params.source);
  }
  if (params.childId) {
    search.set('child_id', params.childId);
  }
  if (params.since) {
    search.set('since', params.since);
  }
  return apiFetch<EmotionEventRecord[]>(`/sync/export/events?${search.toString()}`);
}

export async function exportChatForSync(params: {
  source: string;
  sessionId?: string;
  childId?: string;
  limit?: number;
  since?: string;
}): Promise<ChatMessageRecord[]> {
  const search = new URLSearchParams({ source: params.source, limit: String(params.limit ?? 500) });
  if (params.sessionId) {
    search.set('session_id', params.sessionId);
  }
  if (params.childId) {
    search.set('child_id', params.childId);
  }
  if (params.since) {
    search.set('since', params.since);
  }
  return apiFetch<ChatMessageRecord[]>(`/sync/export/chat?${search.toString()}`);
}

export async function exportLogsForSync(params: {
  limit?: number;
  source?: string;
  childId?: string;
  level?: string;
  since?: string;
}): Promise<SystemLogRecord[]> {
  const search = new URLSearchParams({ limit: String(params.limit ?? 500) });
  if (params.source) {
    search.set('source', params.source);
  }
  if (params.childId) {
    search.set('child_id', params.childId);
  }
  if (params.level) {
    search.set('level', params.level);
  }
  if (params.since) {
    search.set('since', params.since);
  }
  return apiFetch<SystemLogRecord[]>(`/sync/export/logs?${search.toString()}`);
}
