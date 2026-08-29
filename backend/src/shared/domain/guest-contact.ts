export type StructuredGuestContact = {
  email: string | null;
  phone: string | null;
};

export const parseGuestContact = (params: {
  guestEmail?: string | null;
  guestPhone?: string | null;
  guestContact?: string | null;
}): StructuredGuestContact => {
  const explicitEmail = params.guestEmail?.trim().toLowerCase() || null;
  const explicitPhone = params.guestPhone?.trim() || null;
  if (explicitEmail || explicitPhone) return { email: explicitEmail, phone: explicitPhone };

  const parts = (params.guestContact || '')
    .split('·')
    .map((value) => value.trim())
    .filter(Boolean);
  return {
    email: parts.find((value) => value.includes('@'))?.toLowerCase() || null,
    phone: parts.find((value) => !value.includes('@')) || null,
  };
};

export const buildLegacyGuestContact = (contact: StructuredGuestContact) =>
  [contact.email, contact.phone].filter(Boolean).join(' · ') || null;
