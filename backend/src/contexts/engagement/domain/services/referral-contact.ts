export type EngagementAntiFraudConfig = {
  blockSelfByUser: boolean;
  blockSelfByContact: boolean;
};

export const DEFAULT_ENGAGEMENT_ANTI_FRAUD: EngagementAntiFraudConfig = {
  blockSelfByUser: true,
  blockSelfByContact: true,
};

const isAntiFraudPayload = (value?: unknown): value is Partial<EngagementAntiFraudConfig> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const normalizeEngagementAntiFraud = (input?: unknown | null): EngagementAntiFraudConfig => {
  const payload = isAntiFraudPayload(input) ? input : undefined;
  return {
    blockSelfByUser: payload?.blockSelfByUser ?? DEFAULT_ENGAGEMENT_ANTI_FRAUD.blockSelfByUser,
    blockSelfByContact: payload?.blockSelfByContact ?? DEFAULT_ENGAGEMENT_ANTI_FRAUD.blockSelfByContact,
  };
};

export const parseEngagementContactTokens = (contact?: string | null) => {
  if (!contact) return { email: null, phone: null };
  const parts = contact
    .split(/·|\||,|\//)
    .map((item) => item.trim())
    .filter(Boolean);
  let email: string | null = null;
  let phone: string | null = null;
  for (const part of parts) {
    if (!email && part.includes('@')) {
      email = part;
    } else if (!phone) {
      phone = part;
    }
  }
  if (!email && contact.includes('@')) email = contact.trim();
  if (!phone && !contact.includes('@')) phone = contact.trim();
  return { email, phone };
};
