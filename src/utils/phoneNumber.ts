export function formatPhoneNumber(value: string): string {
  // Remove all non-digits
  const digits = value.replace(/\D/g, '');

  // Format as +1.XXX.XXX.XXXX
  if (digits.length === 0) return '';
  if (digits.length <= 1) return `+${digits}`;
  if (digits.length <= 4) return `+${digits.slice(0, 1)}.${digits.slice(1)}`;
  if (digits.length <= 7) return `+${digits.slice(0, 1)}.${digits.slice(1, 4)}.${digits.slice(4)}`;
  return `+${digits.slice(0, 1)}.${digits.slice(1, 4)}.${digits.slice(4, 7)}.${digits.slice(7, 11)}`;
}

export function validatePhoneNumber(value: string): boolean {
  const phoneRegex = /^\+1\.\d{3}\.\d{3}\.\d{4}$/;
  return phoneRegex.test(value);
}
