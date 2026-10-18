export const normalizeSmsRecipient = (value?: string | null) => {
  const raw = value?.trim();
  if (!raw) return null;
  if (raw.startsWith('+')) {
    const digits = raw.replace(/\D/g, '');
    return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
  }
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) {
    const rest = digits.slice(2);
    return /^[1-9]\d{7,14}$/.test(rest) ? `+${rest}` : null;
  }
  if (digits.startsWith('34') && /^[1-9]\d{7,14}$/.test(digits)) return `+${digits}`;
  if (digits.length === 10 && digits.startsWith('0')) return `+34${digits.slice(1)}`;
  if (digits.length === 9) return `+34${digits}`;
  return null;
};
