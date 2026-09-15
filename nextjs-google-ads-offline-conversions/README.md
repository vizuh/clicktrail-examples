# Google Ads Offline Conversion Tracking in Next.js App Router (GCLID, GBRAID, WBRAID)

> Production-ready reference implementation demonstrating how to capture Google Ads click parameters (`gclid`, `gbraid`, `wbraid`), persist them across multi-page user sessions using first-party cookies, and generate privacy-compliant Google Ads Offline Conversion Upload payloads using Next.js Server Actions.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-App%20Router-black.svg)](https://nextjs.org/)
[![Google Ads API](https://img.shields.io/badge/Google%20Ads%20API-v17-green.svg)](https://developers.google.com/google-ads/api/docs/conversions/upload-clicks)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## High-Intent Problem Statement

When running paid acquisition via Google Ads, sending conversion signals exclusively via client-side JavaScript tags (Google Tag / GTM) leads to **20%–45% conversion signal loss** due to:
1. **Ad Blockers & Brave Shields**: Client-side conversion endpoints (`googleadservices.com`) are routinely blocked.
2. **Safari ITP & iOS 14.5+ ATT restrictions**: Cookies set via JavaScript document writes expire prematurely or are stripped.
3. **GBRAID / WBRAID Fragmentation**: iOS privacy parameters replace standard `gclid` for app-to-web and web-to-app journeys.
4. **Deferred Lead Cycles**: B2B leads, scheduled calls, and purchases often happen hours or days after the initial ad click.

This reference pattern implements **ClickTrail Server-Side Google Ads Offline Conversion Tracking** natively inside a Next.js App Router architecture.

---

## Architectural Flow

```
+-------------------------------------------------------------------------------+
| 1. User Clicks Google Ad (?gclid=... or ?gbraid=... or ?wbraid=...)          |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
| 2. Next.js Client Ingestion (LeadCaptureScript / RootLayout)                  |
|    - Parses URLSearchParams for gclid, gbraid, wbraid                         |
|    - Serializes into 90-day First-Party Cookie ('ct_google_click_ids')        |
|    - Sets SameSite=Lax, Secure flags                                          |
+---------------------------------------+---------------------------------------+
                                        | (User navigates site, fills lead form)
                                        v
+-------------------------------------------------------------------------------+
| 3. Lead Form Submission (Next.js Server Action: submitLeadAction)             |
|    - Receives FormData on the Node server runtime                             |
|    - Reads incoming HTTP Cookie header (`ct_google_click_ids`)                |
|    - Validates lead payload (email, phone, name)                              |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
| 4. Enhanced Conversion Normalization & Hash Generation                        |
|    - Email: lowercase, trimmed, SHA-256 hashed                                |
|    - Phone: E.164 standard (+1XXXXXXXXXX), SHA-256 hashed                     |
|    - Click ID Selection: GCLID -> WBRAID -> GBRAID precedence                 |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
| 5. Google Ads Conversion Upload API Payload Delivery                          |
|    - Target: customers/{customer_id}:uploadClickConversions                   |
|    - Google format datetime: yyyy-mm-dd hh:mm:ss+|-hh:mm                      |
|    - Includes Consent Mode v2 flags (ad_user_data, ad_personalization)        |
+-------------------------------------------------------------------------------+
```

---

## Google Click Identifier Guide: GCLID vs GBRAID vs WBRAID

| Parameter | Platform | Use Case | Offline Upload Field |
|---|---|---|---|
| `gclid` | Desktop, Android, iOS Safari (standard) | Standard web click identifier with full 1:1 attribution | `gclid` |
| `gbraid` | iOS 14.5+ (App-to-Web) | Aggregated measurement for campaigns directing users from Google iOS apps | `gbraid` |
| `wbraid` | iOS 14.5+ (Web-to-App / Web) | Aggregated measurement protecting user privacy via Private Click Measurement | `wbraid` |

> **Google Ads Rule:** A single conversion upload entry may only contain **one** click identifier (`gclid`, `gbraid`, OR `wbraid`). This package automatically handles precedence ranking.

---

## Project Structure

```
nextjs-google-ads-offline-conversions/
├── src/
│   ├── app/
│   │   └── actions/
│   │       └── submit-lead.ts          # Server Action: extracts cookie & builds conversion
│   ├── components/
│   │   ├── LeadCaptureScript.tsx       # Client component: extracts URL params to cookie
│   │   └── LeadForm.tsx                # Client component: React form with Server Action
│   ├── lib/
│   │   ├── click-id-tracker.ts         # URL parser, cookie serializer/deserializer
│   │   ├── google-ads-client.ts        # Google Ads API v17 conversion payload builder
│   │   └── hash.ts                     # SHA-256 normalizer (Google Enhanced Conversions)
│   └── types.ts                        # TypeScript contracts
├── test/
│   └── attribution-lifecycle.test.ts   # E2E unit tests for parameter survival
├── package.json
├── tsconfig.json
└── README.md
```

---

## Quick Start & Verification

### Prerequisites
- Node.js >= 20 (Node.js 22/24 recommended)
- npm or pnpm

### Run Tests
```bash
npm test
```

Expected output:
```
✔ End-to-End Attribution Lifecycle: URL click IDs -> Cookie -> Server Action -> Google Ads Payload (35ms)
✔ iOS 14.5+ Attribution: GBRAID and WBRAID survival when GCLID is absent (1ms)
ℹ tests 2
ℹ pass 2
```

---

## Usage in Next.js App Router

### 1. Register Client Capture in `app/layout.tsx`

```tsx
// app/layout.tsx
import { LeadCaptureScript } from '@/components/LeadCaptureScript';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LeadCaptureScript />
        {children}
      </body>
    </html>
  );
}
```

### 2. Add Lead Form in `app/page.tsx`

```tsx
// app/page.tsx
import { LeadForm } from '@/components/LeadForm';

export default function Page() {
  return (
    <main className="container mx-auto py-12">
      <h1 className="text-3xl font-bold text-center mb-8">Get in Touch</h1>
      <LeadForm />
    </main>
  );
}
```

### 3. Server Action (`app/actions/submit-lead.ts`)

```typescript
import { cookies } from 'next/headers';
import { submitLeadAction } from '@/app/actions/submit-lead';

export async function handleLeadSubmit(formData: FormData) {
  'use server';
  const cookieStore = await cookies();
  return await submitLeadAction(formData, { cookiesStore: cookieStore });
}
```

---

## Google Ads API Dispatch Specification

The generated payload complies with the Google Ads API v17 `customers.uploadClickConversions` endpoint:

```json
{
  "customerId": "1234567890",
  "conversions": [
    {
      "conversionAction": "customers/1234567890/conversionActions/9876543210",
      "conversionDateTime": "2026-03-31 14:30:00-04:00",
      "conversionValue": 150.0,
      "currencyCode": "USD",
      "orderId": "lead_1774980000000_a1b2c3",
      "gclid": "CjwKCAjw_pX7BRAkEiwA5SbSOc_mock_google_click_id_987",
      "userIdentifiers": [
        {
          "hashedEmail": "c80521e1a5f4f7fa3235b3e9a7e6b81a0210fdfd058c42a59a22d4f553f19119"
        },
        {
          "hashedPhoneNumber": "b6a7a0b3bfa09bb39659ff8e7b99c8364b4c7188ff6109e99a83850122e2bbfa"
        }
      ],
      "consent": {
        "adUserData": "GRANTED",
        "adPersonalization": "GRANTED"
      }
    }
  ],
  "partialFailure": true
}
```

---

## Production Best Practices

1. **Google Consent Mode v2**: In the EEA, ensure `ad_user_data` and `ad_personalization` flags reflect user consent prior to conversion upload.
2. **Attribution Window**: Google Ads offline click conversions must be uploaded within **90 days** of the click date.
3. **Enhanced Conversions for Leads**: Always provide normalized, SHA-256 hashed emails and phone numbers. This enables Google to match conversions even when cookie or click ID parameters have been truncated.
4. **Idempotency**: Set the `orderId` parameter to the unique lead/order reference in your CRM/database to prevent accidental double-counting on retries.

---

## License

MIT © ClickTrail Architecture Team
