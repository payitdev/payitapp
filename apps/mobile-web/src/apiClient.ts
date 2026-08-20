/**
 * Global API Client Interceptor for Proxim Mobile-Web
 * Dynamically attaches X-Entity-Id header when Business Mode is selected.
 */

let activeEntityId: string | null = null;

export function setActiveEntityId(entityId: string | null): void {
  activeEntityId = entityId;
}

export function getActiveEntityId(): string | null {
  return activeEntityId;
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers || {});

  const token = localStorage.getItem('proxim_auth_token') || localStorage.getItem('proxim_session_token') || localStorage.getItem('payit_auth_token');
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (activeEntityId && !headers.has('X-Entity-Id')) {
    headers.set('X-Entity-Id', activeEntityId);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}

export async function apiFetchJson<T = any>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await apiFetch(input, init);
  return res.json();
}
