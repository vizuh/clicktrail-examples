import {
  CLICK_IDS_COOKIE_NAME,
  parseClickIdsCookie,
} from '../../lib/click-id-tracker.ts';
import {
  buildGoogleAdsClickConversion,
  createUploadRequest,
} from '../../lib/google-ads-client.ts';
import type { ConsentSnapshot, GoogleAdsUploadRequest, LeadFormData } from '../../types.ts';

export interface SubmitLeadResult {
  success: boolean;
  leadId?: string;
  conversionPrepared: boolean;
  suppressionReason?: 'consent' | 'configuration' | 'no_identifier';
  error?: string;
}

export interface ServerActionContext {
  cookieHeader?: string;
  cookiesStore?: {
    get: (name: string) => { value: string } | undefined;
  };
  /** Resolve this from the host's consent record, not from hidden form fields. */
  consent?: ConsentSnapshot;
  /** Server-only configuration. Do not use NEXT_PUBLIC_* variables for these. */
  customerId?: string;
  conversionActionId?: string;
  /** Server-owned stable lead/order reference. */
  orderId?: string;
  /** Actual host event time; do not derive a conversion from request time. */
  conversionDateTime?: Date | string;
  /** Host-owned outbox callback; it must not call a provider directly. */
  enqueueConversion?: (request: GoogleAdsUploadRequest) => Promise<void>;
}

function parseLead(formData: FormData | LeadFormData): LeadFormData {
  if (typeof FormData !== 'undefined' && formData instanceof FormData) {
    const value = formData.get('value')?.toString();
    return {
      email: formData.get('email')?.toString() || '',
      fullName: formData.get('fullName')?.toString() || '',
      phone: formData.get('phone')?.toString() || undefined,
      company: formData.get('company')?.toString() || undefined,
      ...(value === undefined || value === '' ? {} : { value: Number(value) }),
      currency: formData.get('currency')?.toString() || undefined,
    };
  }
  return formData as LeadFormData;
}

function readCookie(context: ServerActionContext): string | undefined {
  if (context.cookiesStore) {
    const item = context.cookiesStore.get(CLICK_IDS_COOKIE_NAME);
    return item ? `${CLICK_IDS_COOKIE_NAME}=${item.value}` : undefined;
  }
  return context.cookieHeader;
}

/**
 * Prepare a server-side conversion after the host accepts a lead.
 * This sample does not create a lead or call Google; the host owns both actions.
 */
export async function submitLeadAction(
  formData: FormData | LeadFormData,
  context: ServerActionContext = {},
): Promise<SubmitLeadResult> {
  const lead = parseLead(formData);
  if (!lead.email || !lead.email.includes('@')) return { success: false, conversionPrepared: false, error: 'Valid email address is required.' };
  if (!context.orderId) return { success: true, conversionPrepared: false, suppressionReason: 'configuration' };
  if (!context.consent || context.consent.advertising !== 'GRANTED') return { success: true, leadId: context.orderId, conversionPrepared: false, suppressionReason: 'consent' };
  if (!context.customerId || !context.conversionActionId || !context.conversionDateTime || !context.enqueueConversion) return { success: true, leadId: context.orderId, conversionPrepared: false, suppressionReason: 'configuration' };

  try {
    const conversion = buildGoogleAdsClickConversion({
      customerId: context.customerId,
      conversionActionId: context.conversionActionId,
      lead,
      clickIds: parseClickIdsCookie(readCookie(context)),
      conversionDateTime: context.conversionDateTime,
      orderId: context.orderId,
      consent: context.consent,
    });
    // The callback writes a host-owned outbox row. The request must not be returned
    // to a browser response because it may contain hashed user identifiers.
    await context.enqueueConversion(createUploadRequest(context.customerId, [conversion]));
    return { success: true, leadId: context.orderId, conversionPrepared: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Conversion preparation failed';
    const noIdentifier = message.includes('identifier');
    return { success: true, leadId: context.orderId, conversionPrepared: false, suppressionReason: noIdentifier ? 'no_identifier' : 'configuration', error: message };
  }
}
