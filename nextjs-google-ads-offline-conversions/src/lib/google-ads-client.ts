import type {
  ClickIds,
  ConsentSnapshot,
  GoogleAdsClickConversion,
  GoogleAdsUploadRequest,
  LeadFormData,
  UserIdentifier,
} from '../types.ts';
import { hashEmail, hashPhone } from './hash.ts';

export interface BuildConversionOptions {
  /** Only use this builder for an eligible existing Google Ads API path. */
  customerId: string;
  conversionActionId: string;
  lead: LeadFormData;
  clickIds?: Partial<ClickIds> | null;
  conversionDateTime: Date | string;
  /** Stable server-owned lead/order reference. Never generate this from PII in this helper. */
  orderId: string;
  consent: Pick<ConsentSnapshot, 'advertising' | 'adUserData' | 'adPersonalization'>;
}

function requiredDigits(value: string, name: string): string {
  const raw = String(value).trim();
  if (!/^[\d-]+$/.test(raw)) throw new TypeError(`${name} must contain only digits and optional separators`);
  const digits = raw.replaceAll('-', '');
  if (!/^\d{1,20}$/.test(digits)) throw new TypeError(`${name} must contain a bounded numeric account identifier`);
  return digits;
}

function requiredId(value: string, name: string): string {
  const id = String(value).trim();
  if (!id || id.length > 512) throw new TypeError(`${name} is required and must be bounded`);
  return id;
}

export function formatGoogleAdsDateTime(date: Date): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new TypeError('conversionDateTime must be a valid Date');
  const pad = (n: number) => n.toString().padStart(2, '0');
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const hours = pad(Math.floor(Math.abs(offset) / 60));
  const minutes = pad(Math.abs(offset) % 60);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${hours}:${minutes}`;
}

function conversionDateTime(value: Date | string): string {
  if (typeof value === 'string') {
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(value)) {
      throw new TypeError('conversionDateTime must use Google Ads date-time format');
    }
    return value;
  }
  return formatGoogleAdsDateTime(value);
}

function optionalMoney(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || value < 0) throw new TypeError('conversion value must be a finite non-negative number');
  return value;
}

function optionalCurrency(value: string | undefined, hasValue: boolean): string | undefined {
  if (!value) {
    if (hasValue) throw new TypeError('currency is required when conversion value is present');
    return undefined;
  }
  const currency = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new TypeError('currency must be an ISO-4217 code');
  return currency;
}

function clickIdFields(clickIds: Partial<ClickIds> | null | undefined): Pick<GoogleAdsClickConversion, 'gclid' | 'gbraid' | 'wbraid'> {
  // Google accepts one click identifier per conversion. This explicit order is a
  // sample policy only; a host may select a different provider-supported policy.
  if (clickIds?.gclid) return { gclid: clickIds.gclid };
  if (clickIds?.wbraid) return { wbraid: clickIds.wbraid };
  if (clickIds?.gbraid) return { gbraid: clickIds.gbraid };
  return {};
}

function userIdentifiers(lead: LeadFormData, consent: BuildConversionOptions['consent']): UserIdentifier[] {
  // Enhanced-conversion identifiers are not constructed when ad-user-data consent
  // is denied or unresolved. The lead itself remains host-owned.
  if (consent.advertising !== 'GRANTED' || consent.adUserData !== 'GRANTED') return [];
  const result: UserIdentifier[] = [];
  if (lead.email) result.push({ hashedEmail: hashEmail(lead.email) });
  if (lead.phone) result.push({ hashedPhoneNumber: hashPhone(lead.phone) });
  return result;
}

/**
 * Build a conversion payload for the eligible existing Google Ads API path.
 * This function has no network side effects. New or restricted projects should
 * use a separately verified Data Manager adapter instead.
 */
export function buildGoogleAdsClickConversion(options: BuildConversionOptions): GoogleAdsClickConversion {
  const customerId = requiredDigits(options.customerId, 'customerId');
  const conversionActionId = requiredDigits(options.conversionActionId, 'conversionActionId');
  const orderId = requiredId(options.orderId, 'orderId');
  const consent = options.consent;
  if (!consent || consent.advertising === 'UNKNOWN' || consent.adUserData === 'UNKNOWN' || consent.adPersonalization === 'UNKNOWN') {
    throw new TypeError('explicit consent states are required; UNKNOWN cannot be upgraded');
  }
  const identifiers = consent.advertising === 'GRANTED' ? clickIdFields(options.clickIds) : {};
  const value = optionalMoney(options.lead.value);
  const currency = optionalCurrency(options.lead.currency, value !== undefined);
  const users = userIdentifiers(options.lead, consent);
  if (!Object.keys(identifiers).length && !users.length) throw new TypeError('a consented click ID or permitted user identifier is required');
  return {
    conversionAction: `customers/${customerId}/conversionActions/${conversionActionId}`,
    conversionDateTime: conversionDateTime(options.conversionDateTime),
    ...(value === undefined ? {} : { conversionValue: value }),
    ...(currency ? { currencyCode: currency } : {}),
    orderId,
    ...identifiers,
    ...(users.length ? { userIdentifiers: users } : {}),
    consent: {
      adUserData: consent.adUserData,
      adPersonalization: consent.adPersonalization,
    },
  };
}

export function createUploadRequest(
  customerId: string,
  conversions: GoogleAdsClickConversion[],
  validateOnly = true,
): GoogleAdsUploadRequest {
  return {
    customerId: requiredDigits(customerId, 'customerId'),
    conversions,
    partialFailure: true,
    validateOnly,
  };
}
