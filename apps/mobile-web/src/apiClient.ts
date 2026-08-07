/**
 * Global API Client Interceptor for PayIT Mobile-Web
 * Dynamically attaches X-Entity-Id header when Business Mode is selected (Issue 1).
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

  const token = localStorage.getItem('payit_auth_token');
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
