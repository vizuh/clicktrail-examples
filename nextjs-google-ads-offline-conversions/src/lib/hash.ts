import { createHash } from 'node:crypto';

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Normalize an email before hashing. The host must decide whether collection is allowed. */
export function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf('@');
  if (at < 1) return normalized;
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (domain !== 'gmail.com' && domain !== 'googlemail.com') return normalized;
  return `${local.split('+', 1)[0].replaceAll('.', '')}@gmail.com`;
}

export function hashEmail(email: string): string {
  return sha256(normalizeEmail(email));
}

/** Require an already country-qualified E.164 number; do not guess a country. */
export function normalizePhone(phone: string): string {
  const normalized = phone.trim().replace(/[^\d+]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) throw new TypeError('phone must be an E.164 number with a country code');
  return normalized;
}

export function hashPhone(phone: string): string {
  return sha256(normalizePhone(phone));
}

export function hashNormalizedString(value: string): string {
  return sha256(value.trim().toLowerCase());
}
