# Consent-aware attribution boundary in Next.js (GCLID, GBRAID, WBRAID)

> **Synthetic reference only.** This example demonstrates an opt-in, bounded
> first-touch handoff from a Next.js landing page to a server-owned conversion
> queue. It does not call Google, create a lead, store PII, or prove provider
> delivery. Review the host application's consent, retention, identity, and
> provider requirements before adapting it.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-App%20Router-black.svg)](https://nextjs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## What this example covers

- capture of `gclid`, `gbraid`, `wbraid`, and allowlisted `utm_*` parameters;
- first-party cookie serialization with bounded values and first-touch retention;
- an explicit consent gate that fails closed for unknown or denied advertising consent;
- server-side validation of a stable host-owned lead/order reference;
- an offline-conversion candidate for an **already verified, eligible** Google Ads API
  path, without a network client;
- tests using synthetic values only.

The implementation deliberately does **not** implement Google Data Manager. New or
restricted Google Ads setups need a separately verified Data Manager contract. Do not
reuse the Ads API request shape for that path.

## Evidence boundary

| Evidence | What it proves | What it does not prove |
| --- | --- | --- |
| Unit tests in `test/` | Allowlist, bounds, first-touch, consent, and payload-shape behaviour | Google acceptance, CRM storage, or campaign attribution |
| A server queue entry | The host accepted a conversion candidate | Provider processing or reporting |
| Google Ads diagnostics/reconciliation | Provider-side receipt and outcome | That browser capture or a local test was correct |

No local command in this example calls Google, a CRM, GTM, or an ad platform.

## Architecture

```text
Landing URL (?gclid=...&utm_*)
        |
        v
Host CMP ---- affirmative advertising consent? ---- no --> no identifier persistence
        |
       yes
        v
Bounded first-touch cookie (optional client fallback; server response preferred)
        |
        v
Host server accepts lead and resolves its internal lead/order ID
        |
        v
Consent + configuration + attribution are validated
        |
        v
Server-owned queue candidate (no browser payload, no provider call here)
```

ClickTrail is an optional capture/normalization boundary. The host application owns:

- the CMP and consent records;
- lead creation, authentication, retention, deletion, and access control;
- CRM and database IDs;
- conversion-stage and revenue truth;
- Google Ads/Data Manager credentials and request contracts;
- retries, idempotency, reconciliation, and provider diagnostics.

Browser-supplied values are untrusted and spoofable. Do not use them for authorization,
pricing, eligibility, or fraud decisions. Do not put email, phone, cookies, tokens, raw
requests, or arbitrary JSON in a data-layer event.

## No-package fallback

A host does not need ClickTrail to use this boundary. Keep the same contract in the
host's existing middleware or cookie utility: allowlist the five UTM keys and three click
IDs, bound every value, gate persistence on affirmative CMP consent, preserve first touch,
and attach the result to a server-owned lead ID. If the host cannot meet those conditions,
do not persist the identifiers. Do not add a package merely to create a cookie.

## Parameters

The parser accepts only these query keys:

- `gclid`, `gbraid`, `wbraid`;
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`.

Values are trimmed and bounded to 512 characters, and the encoded cookie is bounded to 2,048 characters. The sample retains the first non-empty
record and does not replace it with a later visit. The 90-day cookie lifetime is an
example policy, not a Google or ClickTrail default that a host must adopt. A host may use
session-only storage or a shorter policy.

The conversion builder requires:

- server-only customer and conversion-action IDs;
- a server-owned stable `orderId`/lead reference;
- an actual conversion timestamp;
- explicit `advertising`, `adUserData`, and `adPersonalization` consent states;
- one permitted click ID or a permitted enhanced-conversion identifier;
- a value and ISO-4217 currency together, or neither.

Unknown consent is never upgraded to granted. Hashed identifiers are created only in the
server helper and are not returned in the action result. The example requires an E.164
phone number with a country code and does not guess a country.

## Files

```text
nextjs-google-ads-offline-conversions/
├── src/
│   ├── app/actions/submit-lead.ts   # host handoff; no lead/provider mutation
│   ├── components/
│   │   ├── LeadCaptureScript.tsx    # consent-gated optional client fallback
│   │   └── LeadForm.tsx             # illustrative UI; host must wrap the action
│   ├── lib/
│   │   ├── click-id-tracker.ts      # allowlist, bounds, cookie, first touch
│   │   ├── google-ads-client.ts     # no-network eligible Ads API shape builder
│   │   └── hash.ts                  # server-only normalization and SHA-256
│   └── types.ts
└── test/attribution-lifecycle.test.ts
```

## Usage in a host Next.js App Router project

### 1. Resolve consent before rendering capture

```tsx
// app/layout.tsx (illustrative)
import { LeadCaptureScript } from '@/components/LeadCaptureScript';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Read the host CMP state. Do not hard-code true.
  const advertisingConsent = false; // replace with the host's server/CMP bridge
  return (
    <html lang="en">
      <body>
        <LeadCaptureScript advertisingConsent={advertisingConsent} />
        {children}
      </body>
    </html>
  );
}
```

The component does not send a GTM event. If the host needs analytics, it should use its
existing GTM/data-layer contract and apply the same consent gate.

### 2. Wrap the handoff in a real server action

```ts
// app/actions/handle-lead.ts (illustrative)
import { cookies } from 'next/headers';
import { submitLeadAction } from '@/app/actions/submit-lead';

export async function handleLeadSubmit(formData: FormData) {
  'use server';
  const cookieStore = await cookies();
  const lead = await createLeadInHostDatabase(formData); // host-owned transaction
  const consent = await readConsentForLead(lead.id);     // never trust a hidden field
  const occurredAt = await readLeadOccurredAt(lead.id);  // host event time

  return submitLeadAction(formData, {
    cookiesStore: cookieStore,
    consent,
    customerId: process.env.GOOGLE_ADS_CUSTOMER_ID,
    conversionActionId: process.env.GOOGLE_ADS_CONVERSION_ACTION_ID,
    orderId: lead.id,
    conversionDateTime: occurredAt,
    enqueueConversion: request => writeConversionOutbox(request), // host outbox only
  });
}
```

`createLeadInHostDatabase`, `readConsentForLead`, `readLeadOccurredAt`,
`writeConversionOutbox`, the outbox, and the provider client are placeholders for host code. The repository does not ship them.
Pass the resulting `handleLeadSubmit` to `<LeadForm onSubmit={handleLeadSubmit} />`; do
not import the server helper directly into a client component.

### 3. Queue and reconcile on the server

If `conversionPrepared` is true, the host callback has accepted a candidate into its
outbox. Use an immutable event ID and a uniqueness key such as
`destination + action + orderId`. Retry with bounded backoff. Keep provider response,
CRM state, reversals, and reconciliation status separate from the capture record.

For a Data Manager integration, replace the provider contract only after the account,
field mapping, consent requirements, idempotency, and validate-only behaviour have been
verified with the relevant Google documentation and a sandbox or approved test account.

## Verification

From this directory:

```bash
npm test
npm run typecheck
```

The test fixture uses fake IDs and `.test` addresses. It must not be changed to contain
real customer, CRM, Google, or credential data.

## License

MIT © ClickTrail Architecture Team
