const API_BASE_URL = String((import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers || {});
  const token = localStorage.getItem('proxim_auth_token') || localStorage.getItem('proxim_session_token') || localStorage.getItem('payit_auth_token');
  const entityId = new URLSearchParams(window.location.search).get('entityId');

  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  if (entityId && !headers.has('X-Entity-Id')) headers.set('X-Entity-Id', entityId);

  return fetch(input, { ...init, headers });
}

export async function apiFetchJson<T = any>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(apiUrl(path), init);
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || data?.error || 'API request failed');
  return data as T;
}
