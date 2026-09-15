import type { AttributionRecord, ClickIds, CookieOptions } from '../types.ts';

export const CLICK_IDS_COOKIE_NAME = 'ct_attribution';
const DEFAULT_MAX_AGE_DAYS = 90;
const MAX_VALUE_LENGTH = 512;
const MAX_COOKIE_VALUE_LENGTH = 2048;
const KEYS = ['gclid', 'gbraid', 'wbraid', 'utmSource', 'utmMedium', 'utmCampaign', 'utmTerm', 'utmContent', 'landingPage', 'capturedAt'] as const;
type AllowedKey = typeof KEYS[number];

function bound(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, MAX_VALUE_LENGTH) : undefined;
}

function clean(value: unknown): AttributionRecord {
  if (!value || typeof value !== 'object') return {};
  const result: AttributionRecord = {};
  for (const key of KEYS) {
    const item = bound((value as Record<string, unknown>)[key]);
    if (item) (result as Record<AllowedKey, string>)[key] = item;
  }
  return result;
}

function searchValue(searchParams: URLSearchParams, key: string): string | undefined {
  return bound(searchParams.get(key));
}

/** Capture only allowlisted click IDs from a query. */
export function extractClickIds(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>
): Partial<ClickIds> | null {
  const getParam = (key: string): string | undefined => {
    if (searchParams instanceof URLSearchParams) return searchValue(searchParams, key);
    const value = searchParams[key];
    return bound(Array.isArray(value) ? value[0] : value);
  };
  const ids = clean({ gclid: getParam('gclid'), gbraid: getParam('gbraid'), wbraid: getParam('wbraid'), capturedAt: new Date().toISOString() });
  return ids.gclid || ids.gbraid || ids.wbraid ? ids : null;
}

/** Capture click IDs and approved UTM fields from a landing URL. */
export function extractAttribution(input: URL | string | URLSearchParams, now = new Date().toISOString()): AttributionRecord | null {
  let url: URL;
  try {
    url = input instanceof URL
      ? input
      : input instanceof URLSearchParams
        ? new URL(`https://clicktrail.invalid/?${input.toString()}`)
        : new URL(String(input), 'https://clicktrail.invalid/');
  } catch {
    return null;
  }
  const record = clean({
    gclid: searchValue(url.searchParams, 'gclid'),
    gbraid: searchValue(url.searchParams, 'gbraid'),
    wbraid: searchValue(url.searchParams, 'wbraid'),
    utmSource: searchValue(url.searchParams, 'utm_source'),
    utmMedium: searchValue(url.searchParams, 'utm_medium'),
    utmCampaign: searchValue(url.searchParams, 'utm_campaign'),
    utmTerm: searchValue(url.searchParams, 'utm_term'),
    utmContent: searchValue(url.searchParams, 'utm_content'),
    // Keep only the route. Never persist arbitrary query parameters (which may contain PII).
    landingPage: input instanceof URL || typeof input === 'string' ? `${url.origin}${url.pathname}` : undefined,
    capturedAt: bound(now),
  });
  const signalKeys: Array<keyof AttributionRecord> = [
    'gclid', 'gbraid', 'wbraid', 'utmSource', 'utmMedium', 'utmCampaign', 'utmTerm', 'utmContent',
  ];
  return signalKeys.some(key => Boolean(record[key])) ? record : null;
}

/** Keep the first non-empty attribution record. Never let a later visit replace it. */
export function mergeFirstTouch(existing: AttributionRecord | null | undefined, incoming: AttributionRecord | null | undefined): AttributionRecord {
  const current = clean(existing);
  return Object.keys(current).length ? current : clean(incoming);
}

export function serializeClickIdsCookie(
  ids: AttributionRecord,
  options: CookieOptions = {},
): { name: string; value: string; options: Record<string, unknown> } {
  const name = options.name || CLICK_IDS_COOKIE_NAME;
  const maxAgeSeconds = Math.max(1, Math.trunc((options.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS) * 24 * 60 * 60));
  const value = encodeURIComponent(JSON.stringify(clean(ids)));
  if (value.length > MAX_COOKIE_VALUE_LENGTH) throw new TypeError('attribution cookie exceeds the bounded size');
  return {
    name,
    value,
    options: {
      maxAge: maxAgeSeconds,
      path: '/',
      sameSite: options.sameSite || 'Lax',
      secure: options.secure !== false,
      // Client-side fallback cannot set HttpOnly. Prefer a server response cookie.
      httpOnly: false,
      domain: options.domain,
    },
  };
}

export function parseClickIdsCookie(
  cookieString: string | null | undefined,
  cookieName: string = CLICK_IDS_COOKIE_NAME,
): AttributionRecord | null {
  if (!cookieString) return null;
  const prefix = `${cookieName}=`;
  const entry = cookieString.split(';').map(value => value.trim()).find(value => value.startsWith(prefix));
  if (!entry) return null;
  const encodedValue = entry.slice(prefix.length);
  if (encodedValue.length > MAX_COOKIE_VALUE_LENGTH) return null;
  try {
    return clean(JSON.parse(decodeURIComponent(encodedValue)));
  } catch {
    return null;
  }
}
