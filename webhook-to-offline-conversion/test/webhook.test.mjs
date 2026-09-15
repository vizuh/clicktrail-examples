import test from 'node:test';
import assert from 'node:assert/strict';
import { dedupeKey, normalizeWebhook } from '../src/index.mjs';
test('normalizes a CRM won webhook', () => { const event = normalizeWebhook({ source: 'twenty', dealId: 'deal-1', status: 'won', amount: 125, currency: 'eur', customFields: { gclid: 'abc' }, timestamp: 1700000000 }); assert.equal(event.eventName, 'Purchase'); assert.equal(event.value, 125); assert.equal(event.attribution.gclid, 'abc'); });
test('dedupe key is deterministic', () => { const input = { type: 'checkout.session.completed', id: 'cs_1', amount_total: 1000, currency: 'usd', metadata: { gclid: 'abc' } }; assert.equal(dedupeKey(normalizeWebhook(input)), dedupeKey(normalizeWebhook(input))); });
