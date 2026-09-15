import type {
  ClickIds,
  LeadFormData,
  GoogleAdsClickConversion,
  GoogleAdsUploadRequest,
  UserIdentifier
} from '../types.ts';
import { hashEmail, hashPhone } from './hash.ts';

export interface BuildConversionOptions {
  customerId: string;
  conversionActionId: string;
  lead: LeadFormData;
  clickIds?: Partial<ClickIds> | null;
  conversionDateTime?: Date | string;
  orderId?: string;
  adUserDataConsent?: 'GRANTED' | 'DENIED';
  adPersonalizationConsent?: 'GRANTED' | 'DENIED';
}

export function formatGoogleAdsDateTime(date: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  
  const tzOffset = -date.getTimezoneOffset();
  const sign = tzOffset >= 0 ? '+' : '-';
  const tzHours = pad(Math.floor(Math.abs(tzOffset) / 60));
  const tzMinutes = pad(Math.abs(tzOffset) % 60);

  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}${sign}${tzHours}:${tzMinutes}`;
}

export function buildGoogleAdsClickConversion(
  options: BuildConversionOptions
): GoogleAdsClickConversion {
  const { customerId, conversionActionId, lead, clickIds, conversionDateTime, orderId } = options;

  const cleanCustomerId = customerId.replace(/[^\d]/g, '');
  const conversionAction = `customers/${cleanCustomerId}/conversionActions/${conversionActionId}`;

  const formattedDateTime = typeof conversionDateTime === 'string'
    ? conversionDateTime
    : formatGoogleAdsDateTime(conversionDateTime || new Date());

  const conversion: GoogleAdsClickConversion = {
    conversionAction,
    conversionDateTime: formattedDateTime,
    conversionValue: lead.value,
    currencyCode: lead.currency || 'USD',
    orderId: orderId || `lead_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    userIdentifiers: [],
  };

  if (clickIds) {
    if (clickIds.gclid) {
      conversion.gclid = clickIds.gclid;
    } else if (clickIds.wbraid) {
      conversion.wbraid = clickIds.wbraid;
    } else if (clickIds.gbraid) {
      conversion.gbraid = clickIds.gbraid;
    }
  }

  const userIdentifiers: UserIdentifier[] = [];

  if (lead.email) {
    userIdentifiers.push({
      hashedEmail: hashEmail(lead.email),
    });
  }

  if (lead.phone) {
    userIdentifiers.push({
      hashedPhoneNumber: hashPhone(lead.phone),
    });
  }

  if (userIdentifiers.length > 0) {
    conversion.userIdentifiers = userIdentifiers;
  }

  if (options.adUserDataConsent || options.adPersonalizationConsent) {
    conversion.consent = {
      adUserData: options.adUserDataConsent || 'GRANTED',
      adPersonalization: options.adPersonalizationConsent || 'GRANTED',
    };
  }

  return conversion;
}

export function createUploadRequest(
  customerId: string,
  conversions: GoogleAdsClickConversion[],
  partialFailure: boolean = true
): GoogleAdsUploadRequest {
  return {
    customerId: customerId.replace(/[^\d]/g, ''),
    conversions,
    partialFailure,
  };
}
