/**
 * ClickTrail Google Ads Attribution Types
 */

export interface ClickIds {
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  capturedAt: string; // ISO 8601 string
}

export interface LeadFormData {
  fullName: string;
  email: string;
  phone?: string;
  company?: string;
  value?: number;
  currency?: string;
}

export interface UserIdentifier {
  hashedEmail?: string;
  hashedPhoneNumber?: string;
  addressInfo?: {
    hashedFirstName?: string;
    hashedLastName?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    countryCode?: string;
  };
}

export interface GoogleAdsClickConversion {
  conversionAction: string; // Resource name: customers/{customer_id}/conversionActions/{conversion_action_id}
  conversionDateTime: string; // Format: yyyy-mm-dd hh:mm:ss+|-hh:mm (e.g. 2026-03-31 14:30:00-04:00)
  conversionValue?: number;
  currencyCode?: string;
  orderId?: string;
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  userIdentifiers?: UserIdentifier[];
  consent?: {
    adUserData?: 'GRANTED' | 'DENIED';
    adPersonalization?: 'GRANTED' | 'DENIED';
  };
}

export interface GoogleAdsUploadRequest {
  customerId: string;
  conversions: GoogleAdsClickConversion[];
  partialFailure: boolean;
  validateOnly?: boolean;
}

export interface CookieOptions {
  name?: string;
  maxAgeDays?: number;
  sameSite?: 'Lax' | 'Strict' | 'None';
  secure?: boolean;
  domain?: string;
}
