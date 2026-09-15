/** Synthetic example types. Host applications own consent, identity, and persistence. */

export type ConsentValue = 'UNKNOWN' | 'DENIED' | 'GRANTED';

export interface ConsentSnapshot {
  advertising: ConsentValue;
  adUserData: ConsentValue;
  adPersonalization: ConsentValue;
  source?: string;
  policyVersion?: string;
  capturedAt?: string;
}

export interface ClickIds {
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  capturedAt?: string;
}

export interface AttributionRecord extends ClickIds {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  landingPage?: string;
}

export interface LeadFormData {
  fullName?: string;
  email: string;
  phone?: string;
  company?: string;
  value?: number;
  currency?: string;
}

export interface UserIdentifier {
  hashedEmail?: string;
  hashedPhoneNumber?: string;
}

export interface GoogleAdsClickConversion {
  conversionAction: string;
  conversionDateTime: string;
  conversionValue?: number;
  currencyCode?: string;
  orderId: string;
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  userIdentifiers?: UserIdentifier[];
  consent: {
    adUserData: Exclude<ConsentValue, 'UNKNOWN'>;
    adPersonalization: Exclude<ConsentValue, 'UNKNOWN'>;
  };
}

export interface GoogleAdsUploadRequest {
  customerId: string;
  conversions: GoogleAdsClickConversion[];
  /** Google Ads API only; Data Manager uses a different request contract. */
  partialFailure: true;
  validateOnly?: boolean;
}

export interface CookieOptions {
  name?: string;
  maxAgeDays?: number;
  sameSite?: 'Lax' | 'Strict' | 'None';
  secure?: boolean;
  domain?: string;
}
