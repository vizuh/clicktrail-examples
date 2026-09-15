'use client';

import { useEffect } from 'react';
import {
  extractAttribution,
  mergeFirstTouch,
  parseClickIdsCookie,
  serializeClickIdsCookie,
} from '../lib/click-id-tracker.ts';

export interface LeadCaptureScriptProps {
  /** Derived from the host CMP. Defaults to fail-closed. */
  advertisingConsent?: boolean;
}

/**
 * Optional client fallback for a first-party attribution cookie.
 * Prefer setting the cookie in a server response or middleware when possible.
 * This component never writes advertising identifiers without affirmative consent,
 * never pushes them to a data layer, and never overwrites first touch.
 */
export function LeadCaptureScript({ advertisingConsent = false }: LeadCaptureScriptProps) {
  useEffect(() => {
    if (!advertisingConsent || typeof window === 'undefined') return;
    const incoming = extractAttribution(new URL(window.location.href));
    if (!incoming) return;

    const existing = parseClickIdsCookie(document.cookie);
    const merged = mergeFirstTouch(existing, incoming);
    if (existing && Object.keys(existing).length > 0) return;

    const { name, value, options } = serializeClickIdsCookie(merged);
    let cookie = `${name}=${value}; Max-Age=${options.maxAge}; Path=${options.path}; SameSite=${options.sameSite}`;
    if (options.secure && window.location.protocol === 'https:') cookie += '; Secure';
    if (options.domain) cookie += `; Domain=${options.domain}`;
    document.cookie = cookie;
  }, [advertisingConsent]);

  return null;
}
