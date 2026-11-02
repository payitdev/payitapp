import type { FastifyRequest } from 'fastify';

export const API_SCOPES = [
  'accounts:read', 'accounts:write',
  'cards:read', 'cards:write',
  'identity:read', 'identity:write',
  'invoices:read', 'invoices:write',
  'ledger:read', 'payouts:read', 'payouts:write',
  'reports:read', 'treasury:write', 'wallets:write',
] as const;

export const API_WILDCARD_SCOPES = [
  'accounts:all', 'cards:all', 'identity:all', 'invoices:all',
  'ledger:all', 'payouts:all', 'reports:all', 'treasury:all', 'wallets:all',
] as const;

export function requiredScope(request: Pick<FastifyRequest, 'method' | 'url'>): string | null {
  const path = request.url.split('?')[0];
  if (path === '/v1' || path === '/v1/') return null;
  const resource = path.split('/')[2];
  if (!resource) return null;
  if (resource === 'payouts') return path.endsWith('/resolve-account') ? 'payouts:read' : 'payouts:write';
  if (resource === 'invoices') return request.method === 'GET' ? 'invoices:read' : 'invoices:write';
  if (resource === 'cards') return request.method === 'GET' ? 'cards:read' : 'cards:write';
  if (resource === 'identity') return request.method === 'GET' ? 'identity:read' : 'identity:write';
  if (resource === 'accounts') return request.method === 'GET' ? 'accounts:read' : 'accounts:write';
  if (resource === 'transactions' || resource === 'ledger' || resource === 'reports' || resource === 'rates') return 'reports:read';
  if (resource === 'wallets') return 'wallets:write';
  if (resource === 'treasury') return 'treasury:write';
  return null;
}

export function hasApiScope(scopes: string[], required: string): boolean {
  return scopes.some(scope => scope === 'all' || scope === required || scope === `${required.split(':')[0]}:all`);
}
