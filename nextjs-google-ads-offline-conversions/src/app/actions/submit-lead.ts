import {
  parseClickIdsCookie,
  CLICK_IDS_COOKIE_NAME
} from '../../lib/click-id-tracker.ts';
import {
  buildGoogleAdsClickConversion,
  createUploadRequest
} from '../../lib/google-ads-client.ts';
import type { LeadFormData, GoogleAdsUploadRequest } from '../../types.ts';

export interface SubmitLeadResult {
  success: boolean;
  leadId?: string;
  conversionPayload?: GoogleAdsUploadRequest;
  error?: string;
}

export interface ServerActionContext {
  cookieHeader?: string;
  cookiesStore?: {
    get: (name: string) => { value: string } | undefined;
  };
}

export async function submitLeadAction(
  formData: FormData | LeadFormData,
  context?: ServerActionContext
): Promise<SubmitLeadResult> {
  try {
    let lead: LeadFormData;
    if (typeof FormData !== 'undefined' && formData instanceof FormData) {
      const email = formData.get('email')?.toString() || '';
      const fullName = formData.get('fullName')?.toString() || '';
      const phone = formData.get('phone')?.toString();
      const company = formData.get('company')?.toString();
      const valueStr = formData.get('value')?.toString();

      lead = {
        email,
        fullName,
        phone,
        company,
        value: valueStr ? parseFloat(valueStr) : 50.0,
        currency: 'USD',
      };
    } else {
      lead = formData as LeadFormData;
    }

    if (!lead.email || !lead.email.includes('@')) {
      return { success: false, error: 'Valid email address is required.' };
    }

    let rawCookie: string | undefined;

    if (context?.cookiesStore) {
      const cookieObj = context.cookiesStore.get(CLICK_IDS_COOKIE_NAME);
      if (cookieObj) rawCookie = `${CLICK_IDS_COOKIE_NAME}=${cookieObj.value}`;
    } else if (context?.cookieHeader) {
      rawCookie = context.cookieHeader;
    }

    const clickIds = parseClickIdsCookie(rawCookie, CLICK_IDS_COOKIE_NAME);

    const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID || '1234567890';
    const conversionActionId = process.env.GOOGLE_ADS_CONVERSION_ACTION_ID || '9876543210';
    const leadId = `lead_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const conversion = buildGoogleAdsClickConversion({
      customerId,
      conversionActionId,
      lead,
      clickIds,
      orderId: leadId,
      adUserDataConsent: 'GRANTED',
      adPersonalizationConsent: 'GRANTED',
    });

    const uploadRequest = createUploadRequest(customerId, [conversion]);

    return {
      success: true,
      leadId,
      conversionPayload: uploadRequest,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to submit lead',
    };
  }
}
