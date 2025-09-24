/**
 * Phone number normalization utilities for Maldives (+960) country code
 */

/**
 * Normalizes a phone number to always include the +960 country code
 * @param phoneNumber - The phone number to normalize
 * @returns Normalized phone number with +960 prefix
 */
export function normalizePhoneNumber(phoneNumber: string): string {
  if (!phoneNumber) return phoneNumber;
  
  // Remove any spaces, dashes, or other formatting
  let cleaned = phoneNumber.replace(/[\s\-\(\)]/g, '');
  
  // If it already starts with +960, return as is
  if (cleaned.startsWith('+960')) {
    return cleaned;
  }
  
  // If it starts with 960 (without +), add the +
  if (cleaned.startsWith('960')) {
    return '+' + cleaned;
  }
  
  // If it's a local number (7 digits), add +960
  if (/^7\d{6}$/.test(cleaned)) {
    return '+960' + cleaned;
  }
  
  // If it's a local number without leading 7, add +9607
  if (/^\d{6}$/.test(cleaned)) {
    return '+9607' + cleaned;
  }
  
  // For any other format, assume it's already normalized or return as is
  return phoneNumber;
}

/**
 * Checks if two phone numbers represent the same contact
 * @param phone1 - First phone number
 * @param phone2 - Second phone number
 * @returns True if they represent the same contact
 */
export function isSameContact(phone1: string, phone2: string): boolean {
  const normalized1 = normalizePhoneNumber(phone1);
  const normalized2 = normalizePhoneNumber(phone2);
  return normalized1 === normalized2;
}

/**
 * Extracts the local number part from a normalized phone number
 * @param phoneNumber - The normalized phone number
 * @returns The local number part (7 digits)
 */
export function getLocalNumber(phoneNumber: string): string {
  const normalized = normalizePhoneNumber(phoneNumber);
  if (normalized.startsWith('+960')) {
    return normalized.substring(4); // Remove +960
  }
  return normalized;
}

/**
 * Formats a phone number for display
 * @param phoneNumber - The phone number to format
 * @returns Formatted phone number for display
 */
export function formatPhoneForDisplay(phoneNumber: string): string {
  const normalized = normalizePhoneNumber(phoneNumber);
  const local = getLocalNumber(normalized);
  
  // Format as +960 777-1234
  if (local.length === 7) {
    return `+960 ${local.substring(0, 3)}-${local.substring(3)}`;
  }
  
  return normalized;
}
