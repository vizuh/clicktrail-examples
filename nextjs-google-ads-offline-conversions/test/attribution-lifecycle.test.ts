import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractClickIds,
  serializeClickIdsCookie,
  parseClickIdsCookie,
  CLICK_IDS_COOKIE_NAME
} from '../src/lib/click-id-tracker.ts';
import { hashEmail, hashPhone } from '../src/lib/hash.ts';
import { submitLeadAction } from '../src/app/actions/submit-lead.ts';

test('End-to-End Attribution Lifecycle: URL click IDs -> Cookie -> Server Action -> Google Ads Payload', async (t) => {
  // Step 1: Simulate user landing from Google Ads with GCLID
  const sampleGclid = 'CjwKCAjw_pX7BRAkEiwA5SbSOc_mock_google_click_id_987';
  const incomingUrl = new URL(`https://example.com/demo?gclid=${sampleGclid}&utm_source=google&utm_medium=cpc`);
  
  const extractedIds = extractClickIds(incomingUrl.searchParams);
  assert.ok(extractedIds, 'Click IDs should be successfully extracted from URL');
  assert.equal(extractedIds.gclid, sampleGclid, 'GCLID should match incoming URL param');

  // Step 2: Simulate client-side cookie persistence (90 days)
  const cookieData = serializeClickIdsCookie(extractedIds);
  assert.equal(cookieData.name, CLICK_IDS_COOKIE_NAME);
  assert.ok(cookieData.value, 'Cookie value must be encoded string');
  assert.equal(cookieData.options.maxAge, 90 * 24 * 60 * 60, 'Max-Age must default to 90 days');
  assert.equal(cookieData.options.sameSite, 'Lax');

  // Step 3: Simulate browser sending cookie header in HTTP request
  const simulatedCookieHeader = `${cookieData.name}=${cookieData.value}; other_cookie=xyz`;
  const parsedFromHeader = parseClickIdsCookie(simulatedCookieHeader);
  assert.ok(parsedFromHeader, 'Server should parse click IDs from Cookie header');
  assert.equal(parsedFromHeader.gclid, sampleGclid);

  // Step 4: Lead submits contact form -> Server Action execution
  const leadData = {
    fullName: 'Grace Hopper',
    email: 'grace.hopper@example.com',
    phone: '+1 (555) 019-2834',
    company: 'US Navy Comp',
    value: 150.0,
    currency: 'USD',
  };

  const actionResult = await submitLeadAction(leadData, {
    cookieHeader: simulatedCookieHeader,
  });

  // Step 5: Verify the offline conversion payload conforms to Google Ads API requirements
  assert.ok(actionResult.success, 'Server action should succeed');
  assert.ok(actionResult.conversionPayload, 'Conversion payload must be generated');

  const uploadRequest = actionResult.conversionPayload;
  assert.ok(uploadRequest.conversions.length === 1, 'Should contain 1 conversion');
  
  const conversion = uploadRequest.conversions[0];
  // Verify GCLID survived all the way to the conversion payload
  assert.equal(conversion.gclid, sampleGclid, 'GCLID must survive intact to the Google Ads upload payload');
  assert.equal(conversion.conversionValue, 150.0);
  assert.equal(conversion.currencyCode, 'USD');

  // Verify Enhanced Conversions user identifiers
  assert.ok(conversion.userIdentifiers && conversion.userIdentifiers.length >= 1);
  const expectedHashedEmail = hashEmail('grace.hopper@example.com');
  const expectedHashedPhone = hashPhone('+1 (555) 019-2834');
  
  assert.equal(conversion.userIdentifiers[0].hashedEmail, expectedHashedEmail);
  assert.equal(conversion.userIdentifiers[1].hashedPhoneNumber, expectedHashedPhone);

  // Verify Google Ads DateTime format: yyyy-mm-dd hh:mm:ss+|-hh:mm
  const dateRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;
  assert.match(conversion.conversionDateTime, dateRegex, 'DateTime must match Google Ads specification');

  // Verify Consent Mode flags
  assert.deepEqual(conversion.consent, {
    adUserData: 'GRANTED',
    adPersonalization: 'GRANTED',
  });
});

test('iOS 14.5+ Attribution: GBRAID and WBRAID survival when GCLID is absent', async () => {
  const wbraidValue = 'CjgKCAjw_wbraid_sample_ios_web_conversion_123';
  const urlParams = new URLSearchParams({ wbraid: wbraidValue });
  
  const extracted = extractClickIds(urlParams);
  assert.ok(extracted);
  assert.equal(extracted.wbraid, wbraidValue);

  const cookie = serializeClickIdsCookie(extracted);
  const cookieHeader = `${cookie.name}=${cookie.value}`;

  const result = await submitLeadAction(
    { fullName: 'Alan Turing', email: 'alan@bletchley.org', value: 200 },
    { cookieHeader }
  );

  assert.ok(result.success);
  const conversion = result.conversionPayload!.conversions[0];
  assert.equal(conversion.wbraid, wbraidValue, 'WBRAID should be present in Google Ads payload');
  assert.equal(conversion.gclid, undefined, 'GCLID should be undefined');
});
