import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLICK_IDS_COOKIE_NAME,
  extractAttribution,
  extractClickIds,
  mergeFirstTouch,
  parseClickIdsCookie,
  serializeClickIdsCookie,
} from '../src/lib/click-id-tracker.ts';
import { buildGoogleAdsClickConversion, createUploadRequest } from '../src/lib/google-ads-client.ts';
import { hashEmail, hashPhone } from '../src/lib/hash.ts';
import { submitLeadAction } from '../src/app/actions/submit-lead.ts';
import type { ConsentSnapshot, LeadFormData } from '../src/types.ts';

const granted: ConsentSnapshot = {
  advertising: 'GRANTED',
  adUserData: 'GRANTED',
  adPersonalization: 'GRANTED',
  source: 'synthetic-cmp',
  policyVersion: 'test-v1',
};

const lead: LeadFormData = {
  fullName: 'Synthetic User',
  email: 'person@example.test',
  phone: '+15550192834',
  value: 150,
  currency: 'USD',
};

test('allowlisted attribution survives URL → first-touch cookie → server builder', () => {
  const sampleGclid = 'synthetic-gclid-987';
  const attribution = extractAttribution(
    `https://example.test/demo?gclid=${sampleGclid}&utm_source=google&utm_medium=cpc&utm_campaign=demo&ignored=drop`,
    '2026-09-15T10:00:00.000Z',
  );
  assert.ok(attribution);
  if (!attribution) throw new Error('synthetic attribution should be present');
  assert.equal(attribution.gclid, sampleGclid);
  assert.equal(attribution.utmSource, 'google');
  assert.equal(attribution.landingPage, 'https://example.test/demo');
  assert.equal((attribution as Record<string, unknown>).ignored, undefined);

  const cookie = serializeClickIdsCookie(attribution);
  assert.equal(cookie.name, CLICK_IDS_COOKIE_NAME);
  assert.equal(cookie.options.maxAge, 90 * 24 * 60 * 60);
  assert.equal(cookie.options.sameSite, 'Lax');

  const parsed = parseClickIdsCookie(`${cookie.name}=${cookie.value}; other_cookie=xyz`);
  assert.deepEqual(parsed, attribution);

  const conversion = buildGoogleAdsClickConversion({
    customerId: '123-456-7890',
    conversionActionId: '9876543210',
    lead,
    clickIds: parsed,
    conversionDateTime: '2026-09-15 10:30:00+00:00',
    orderId: 'lead-synthetic-001',
    consent: granted,
  });
  assert.equal(conversion.gclid, sampleGclid);
  assert.equal(conversion.conversionValue, 150);
  assert.equal(conversion.currencyCode, 'USD');
  assert.equal(conversion.orderId, 'lead-synthetic-001');
  assert.equal(conversion.userIdentifiers?.[0]?.hashedEmail, hashEmail(lead.email));
  assert.equal(conversion.userIdentifiers?.[1]?.hashedPhoneNumber, hashPhone(lead.phone!));
  assert.deepEqual(conversion.consent, { adUserData: 'GRANTED', adPersonalization: 'GRANTED' });

  const request = createUploadRequest('123-456-7890', [conversion]);
  assert.equal(request.customerId, '1234567890');
  assert.equal(request.validateOnly, true);
  assert.equal(request.partialFailure, true);
});

test('no click or UTM signal produces no attribution record', () => {
  assert.equal(extractAttribution('https://example.test/demo'), null);
  assert.equal(extractClickIds(new URLSearchParams({ utm_source: 'google' })), null);
  assert.throws(() => serializeClickIdsCookie({ gclid: 'x'.repeat(512), utmCampaign: 'y'.repeat(512), utmContent: 'z'.repeat(512), utmMedium: 'm'.repeat(512), utmSource: 's'.repeat(512), utmTerm: 't'.repeat(512) }), /bounded size/);
});

test('first touch is not overwritten by a later landing', () => {
  const first = extractAttribution('https://example.test/?gclid=first&utm_campaign=first', '2026-09-15T10:00:00.000Z')!;
  const later = extractAttribution('https://example.test/?gclid=later&utm_campaign=later', '2026-09-16T10:00:00.000Z')!;
  assert.deepEqual(mergeFirstTouch(first, later), first);
  assert.deepEqual(mergeFirstTouch(null, later), later);
});

test('GBRAID and WBRAID remain supported when GCLID is absent', () => {
  for (const [key, value] of [['gbraid', 'synthetic-gbraid-123'], ['wbraid', 'synthetic-wbraid-123']] as const) {
    const attribution = extractAttribution(new URLSearchParams({ [key]: value }), '2026-09-15T10:00:00.000Z')!;
    const conversion = buildGoogleAdsClickConversion({
      customerId: '1234567890',
      conversionActionId: '9876543210',
      lead: { email: '' },
      clickIds: attribution,
      conversionDateTime: new Date('2026-09-15T10:30:00Z'),
      orderId: `lead-${key}`,
      consent: granted,
    });
    assert.equal(conversion[key], value);
    assert.equal(conversion.gclid, undefined);
    assert.equal(conversion.userIdentifiers, undefined);
  }
});

test('server action hands a candidate to the host outbox without returning it', async () => {
  let queued: unknown;
  const cookie = serializeClickIdsCookie({ gclid: 'synthetic-gclid', capturedAt: '2026-09-15T10:00:00.000Z' });
  const result = await submitLeadAction(lead, {
    cookieHeader: `${cookie.name}=${cookie.value}`,
    consent: granted,
    customerId: '1234567890',
    conversionActionId: '9876543210',
    orderId: 'lead-queued',
    conversionDateTime: '2026-09-15 10:30:00+00:00',
    enqueueConversion: async request => { queued = request; },
  });
  assert.deepEqual(result, { success: true, leadId: 'lead-queued', conversionPrepared: true });
  assert.ok(queued);
  assert.equal('conversionPayload' in result, false);
  assert.equal((queued as { conversions: Array<{ gclid?: string }> }).conversions[0].gclid, 'synthetic-gclid');
});

test('capture and enhanced identifiers fail closed without consent', async () => {
  const denied: ConsentSnapshot = { ...granted, advertising: 'DENIED', adUserData: 'DENIED' };
  assert.throws(() => buildGoogleAdsClickConversion({
    customerId: '1234567890',
    conversionActionId: '9876543210',
    lead,
    clickIds: { gclid: 'synthetic-gclid' },
    conversionDateTime: '2026-09-15 10:30:00+00:00',
    orderId: 'lead-denied',
    consent: denied,
  }), /consented click ID|permitted user identifier/);

  const result = await submitLeadAction(lead, {
    cookieHeader: 'ct_attribution=not-used',
    consent: denied,
    customerId: '1234567890',
    conversionActionId: '9876543210',
    orderId: 'lead-denied',
  });
  assert.deepEqual(result, {
    success: true,
    leadId: 'lead-denied',
    conversionPrepared: false,
    suppressionReason: 'consent',
  });
});

test('unknown consent and missing configuration never get promoted to defaults', async () => {
  const unknown: ConsentSnapshot = { ...granted, advertising: 'UNKNOWN' };
  assert.throws(() => buildGoogleAdsClickConversion({
    customerId: '1234567890',
    conversionActionId: '9876543210',
    lead,
    clickIds: { gclid: 'synthetic-gclid' },
    conversionDateTime: '2026-09-15 10:30:00+00:00',
    orderId: 'lead-unknown',
    consent: unknown,
  }), /explicit consent/);

  const result = await submitLeadAction(lead);
  assert.deepEqual(result, { success: true, conversionPrepared: false, suppressionReason: 'configuration' });
  assert.throws(() => createUploadRequest('', []), /customerId/);
});

test('conversion values are optional but cannot be invented or half-specified', () => {
  const conversion = buildGoogleAdsClickConversion({
    customerId: '1234567890',
    conversionActionId: '9876543210',
    lead: { email: '' },
    clickIds: { gclid: 'synthetic-gclid' },
    conversionDateTime: '2026-09-15 10:30:00+00:00',
    orderId: 'lead-no-value',
    consent: granted,
  });
  assert.equal(conversion.conversionValue, undefined);
  assert.equal(conversion.currencyCode, undefined);
  assert.throws(() => buildGoogleAdsClickConversion({
    customerId: '1234567890',
    conversionActionId: '9876543210',
    lead: { email: '', value: 10 },
    clickIds: { gclid: 'synthetic-gclid' },
    conversionDateTime: '2026-09-15 10:30:00+00:00',
    orderId: 'lead-no-currency',
    consent: granted,
  }), /currency/);
});

test('hashing uses documented normalization and does not guess phone country', () => {
  assert.equal(hashEmail(' Ada.Lovelace+demo@Gmail.com '), hashEmail('adalovelace@gmail.com'));
  assert.throws(() => hashPhone('(555) 019-2834'), /E\.164/);
});
