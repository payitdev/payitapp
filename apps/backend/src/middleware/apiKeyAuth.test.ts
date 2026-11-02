import assert from 'node:assert/strict';
import test from 'node:test';
import type { FastifyRequest } from 'fastify';
import { requiredScope } from './apiScope.js';

function request(method: string, url: string): FastifyRequest {
  return { method, url } as FastifyRequest;
}

test('maps read and write API operations to distinct scopes', () => {
  assert.equal(requiredScope(request('GET', '/v1/invoices')), 'invoices:read');
  assert.equal(requiredScope(request('POST', '/v1/invoices')), 'invoices:write');
  assert.equal(requiredScope(request('GET', '/v1/payouts/resolve-account')), 'payouts:read');
  assert.equal(requiredScope(request('POST', '/v1/payouts/batch')), 'payouts:write');
  assert.equal(requiredScope(request('GET', '/v1/cards')), 'cards:read');
  assert.equal(requiredScope(request('POST', '/v1/cards')), 'cards:write');
});

test('does not require a scope for discovery', () => {
  assert.equal(requiredScope(request('GET', '/v1')), null);
  assert.equal(requiredScope(request('GET', '/v1/')), null);
});
