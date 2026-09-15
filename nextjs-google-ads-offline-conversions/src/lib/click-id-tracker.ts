import type { ClickIds, CookieOptions } from '../types.ts';

export const CLICK_IDS_COOKIE_NAME = 'ct_google_click_ids';
const DEFAULT_MAX_AGE_DAYS = 90;

export function extractClickIds(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>
): Partial<ClickIds> | null {
  const getParam = (key: string): string | undefined => {
    if (searchParams instanceof URLSearchParams) {
      const val = searchParams.get(key);
      return val ? val.trim() : undefined;
    }
    const val = searchParams[key];
    if (Array.isArray(val)) return val[0]?.trim();
    if (typeof val === 'string') return val.trim();
    return undefined;
  };

  const gclid = getParam('gclid');
  const gbraid = getParam('gbraid');
  const wbraid = getParam('wbraid');

  if (!gclid && !gbraid && !wbraid) {
    return null;
  }

  return {
    ...(gclid ? { gclid } : {}),
    ...(gbraid ? { gbraid } : {}),
    ...(wbraid ? { wbraid } : {}),
    capturedAt: new Date().toISOString(),
  };
}

export function serializeClickIdsCookie(
  ids: Partial<ClickIds>,
  options: CookieOptions = {}
): { name: string; value: string; options: Record<string, any> } {
  const name = options.name || CLICK_IDS_COOKIE_NAME;
  const maxAgeSeconds = (options.maxAgeDays || DEFAULT_MAX_AGE_DAYS) * 24 * 60 * 60;
  
  const payload = JSON.stringify({
    g: ids.gclid,
    gb: ids.gbraid,
    wb: ids.wbraid,
    t: ids.capturedAt || new Date().toISOString(),
  });

  return {
    name,
    value: encodeURIComponent(payload),
    options: {
      maxAge: maxAgeSeconds,
      path: '/',
      sameSite: options.sameSite || 'Lax',
      secure: options.secure !== undefined ? options.secure : true,
      httpOnly: false,
      domain: options.domain,
    },
  };
}

export function parseClickIdsCookie(
  cookieString: string | null | undefined,
  cookieName: string = CLICK_IDS_COOKIE_NAME
): Partial<ClickIds> | null {
  if (!cookieString) return null;

  const cookies = cookieString.split(';').map(c => c.trim());
  const targetPrefix = `${cookieName}=`;
  const cookieEntry = cookies.find(c => c.startsWith(targetPrefix));

  if (!cookieEntry) return null;

  try {
    const rawVal = cookieEntry.slice(targetPrefix.length);
    const decoded = decodeURIComponent(rawVal);
    const parsed = JSON.parse(decoded);

    return {
      ...(parsed.g ? { gclid: parsed.g } : {}),
      ...(parsed.gb ? { gbraid: parsed.gb } : {}),
      ...(parsed.wb ? { wbraid: parsed.wb } : {}),
      capturedAt: parsed.t || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
