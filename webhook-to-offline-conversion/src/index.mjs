import { createHash } from 'node:crypto';
const clickKeys = ['gclid','gbraid','wbraid','fbclid','fbc','fbp','msclkid','ttclid','li_fat_id'];
export function eventId(source, id, eventName) { return `${source}_${id}_${eventName}`.toLowerCase().replace(/[^a-z0-9_-]/g, '_'); }
export function normalizeWebhook(payload = {}) {
  const source = payload.source || (payload.type?.startsWith('checkout.') ? 'stripe' : 'crm');
  const id = String(payload.id || payload.dealId || payload.orderId || '');
  if (!id) throw new TypeError('webhook source ID is required');
  const eventName = payload.status === 'won' || payload.type === 'checkout.session.completed' ? 'Purchase' : 'Lead';
  const metadata = { ...(payload.metadata || {}), ...(payload.customFields || {}) };
  const attribution = Object.fromEntries(clickKeys.flatMap((key) => metadata[key] ? [[key, String(metadata[key]).slice(0, 512)]] : []));
  return { eventId: eventId(source, id, eventName), externalId: id, eventName, occurredAt: Number(payload.timestamp || payload.created || Math.floor(Date.now() / 1000)), value: Number(payload.amount || payload.amount_total || 0), currency: String(payload.currency || 'USD').toUpperCase(), attribution };
}
export function dedupeKey(event) { return createHash('sha256').update(`${event.eventId}|${event.eventName}`).digest('hex'); }
