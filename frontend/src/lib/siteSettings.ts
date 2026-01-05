import { SocialLinks } from '@/data/types';

const SOCIAL_BASES: Record<keyof SocialLinks, string> = {
  instagram: 'https://www.instagram.com/',
  x: 'https://x.com/',
  tiktok: 'https://www.tiktok.com/@',
  youtube: 'https://www.youtube.com/',
  linkedin: 'https://www.linkedin.com/in/',
};

export const buildSocialUrl = <K extends keyof SocialLinks>(platform: K, handle?: string) => {
  if (!handle) return '';
  const value = handle.trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  const user = value.replace(/^@/, '');
  const base = SOCIAL_BASES[platform];
  return base ? `${base}${user}` : value;
};

export const normalizePhoneParts = (phone: string) => {
  const clean = (phone || '').trim();
  const digits = clean.replace(/\D/g, '');
  if (clean.startsWith('+') && digits.length > 0) {
    if (digits.startsWith('34') && digits.length >= 2) {
      return { prefix: '+34', number: digits.slice(2) };
    }
    if (digits.length <= 3) {
      return { prefix: `+${digits}`, number: '' };
    }
    if (digits.length === 11) {
      return { prefix: `+${digits.slice(0, 2)}`, number: digits.slice(2) };
    }
    if (digits.length === 12) {
      return { prefix: `+${digits.slice(0, 3)}`, number: digits.slice(3) };
    }
    const country = digits.slice(0, 3);
    return { prefix: `+${country}`, number: digits.slice(3) };
  }
  if (digits.length > 9) {
    const country = digits.slice(0, digits.length - 9);
    const rest = digits.slice(-9);
    return { prefix: country ? `+${country}` : '', number: rest };
  }
  return { prefix: '', number: digits };
};

export const composePhone = (prefix: string, number: string) => {
  const cleanPrefix = prefix.trim();
  const cleanNumber = number.replace(/\D/g, '');
  return `${cleanPrefix}${cleanNumber}`.trim();
};

export const formatPhoneDisplay = (phone: string) => {
  const { prefix, number } = normalizePhoneParts(phone);
  if (!prefix && !number) return '';
  const grouped = number.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
  return prefix ? `${prefix} ${grouped}`.trim() : grouped;
};

export const buildWhatsappLink = (phone: string) => {
  const { prefix, number } = normalizePhoneParts(phone);
  const digits = `${prefix}${number}`.replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : '';
};
