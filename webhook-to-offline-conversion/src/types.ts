/**
 * Attribution & Offline Conversion Webhook Types
 */

export interface CustomerData {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  clientIp?: string;
  clientUserAgent?: string;
}

export interface AttributionClickIds {
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  fbclid?: string;
  fbp?: string;
  fbc?: string;
  msclkid?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export interface NormalizedAttributionEvent {
  eventId: string; // Deterministic event_id (e.g. evt_s-...)
  externalId: string; // Source system reference ID (e.g. stripe_ch_123 or deal_987)
  eventName: 'Purchase' | 'Lead' | 'Subscribe';
  occurredAt: number; // Unix timestamp in seconds
  occurredAtIso: string; // ISO 8601 string
  amount: number;
  currency: string;
  customer: CustomerData;
  attribution: AttributionClickIds;
  metadata?: Record<string, any>;
}

export interface StripeCheckoutWebhookPayload {
  id: string;
  type: string;
  created: number;
  data: {
    object: {
      id: string;
      object: 'checkout.session';
      amount_total: number; // In cents
      currency: string;
      customer_details?: {
        email?: string;
        phone?: string;
        name?: string;
        address?: {
          city?: string;
          state?: string;
          postal_code?: string;
          country?: string;
        };
      };
      client_reference_id?: string;
      metadata?: {
        gclid?: string;
        gbraid?: string;
        wbraid?: string;
        fbclid?: string;
        fbp?: string;
        fbc?: string;
        utm_source?: string;
        utm_campaign?: string;
        [key: string]: any;
      };
    };
  };
}

export interface GenericCrmWebhookPayload {
  event: string;
  dealId: string;
  status: string;
  amount: number;
  currency: string;
  timestamp: string;
  contact: {
    email: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
  };
  customFields?: {
    gclid?: string;
    fbclid?: string;
    fbp?: string;
    fbc?: string;
    [key: string]: any;
  };
}

export interface GoogleAdsClickConversionPayload {
  customerId: string;
  conversions: Array<{
    conversionAction: string;
    conversionDateTime: string;
    conversionValue: number;
    currencyCode: string;
    orderId: string;
    gclid?: string;
    gbraid?: string;
    wbraid?: string;
    userIdentifiers: Array<{
      hashedEmail?: string;
      hashedPhoneNumber?: string;
    }>;
  }>;
  partialFailure: boolean;
}

export interface MetaCapiEventPayload {
  data: Array<{
    event_name: string;
    event_time: number;
    event_id: string;
    action_source: 'website' | 'system_generated' | 'chat';
    user_data: {
      em?: string[]; // Hashed SHA-256
      ph?: string[]; // Hashed SHA-256
      fn?: string[]; // Hashed SHA-256
      ln?: string[]; // Hashed SHA-256
      fbp?: string;
      fbc?: string;
      client_ip_address?: string;
      client_user_agent?: string;
    };
    custom_data: {
      currency: string;
      value: number;
      order_id?: string;
    };
  }>;
}
