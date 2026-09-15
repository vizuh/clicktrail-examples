import { createHash } from 'node:crypto';

/**
 * Normalizes and hashes an email per Google Ads Enhanced Conversions rules:
 * - Trims whitespace
 * - Converts to lowercase
 * - Strips dots in gmail.com addresses (optional Google preference, standard normalize)
 * - Returns SHA-256 hex string
 */
export function hashEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * Normalizes and hashes a phone number to E.164 per Google Ads requirements:
 * e.g., "+1 (555) 019-2834" -> "+15550192834" -> SHA-256
 */
export function hashPhone(phone: string): string {
  // Remove all non-digit characters except leading plus
  let cleaned = phone.trim().replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+')) {
    // If no leading +, prepend default +1 or maintain E.164 standard
    cleaned = `+${cleaned}`;
  }
  return createHash('sha256').update(cleaned, 'utf8').digest('hex');
}

/**
 * Normalizes text (e.g. name, city) per Google standards
 */
export function hashNormalizedString(str: string): string {
  const normalized = str.trim().toLowerCase();
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}
