'use client';

import { useEffect } from 'react';
import { extractClickIds, serializeClickIdsCookie } from '../lib/click-id-tracker.ts';

/**
 * Client-side component to place in Next.js App Router RootLayout.
 * On initial page load, inspects URL query parameters for gclid, gbraid, wbraid.
 * If detected, sets a 90-day first-party cookie.
 */
export function LeadCaptureScript() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const searchParams = new URLSearchParams(window.location.search);
    const clickIds = extractClickIds(searchParams);

    if (clickIds) {
      const { name, value, options } = serializeClickIdsCookie(clickIds);
      
      let cookieStr = `${name}=${value}; Max-Age=${options.maxAge}; Path=${options.path}; SameSite=${options.sameSite}`;
      if (options.secure && window.location.protocol === 'https:') {
        cookieStr += '; Secure';
      }
      if (options.domain) {
        cookieStr += `; Domain=${options.domain}`;
      }

      document.cookie = cookieStr;
      // Optional: Fire dataLayer event or custom event for GTM
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: 'clicktrail_click_ids_captured',
        click_ids: clickIds,
      });
    }
  }, []);

  return null;
}

declare global {
  interface Window {
    dataLayer?: any[];
  }
}
