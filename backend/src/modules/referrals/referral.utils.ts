import { RewardType } from '@prisma/client';

export type AntiFraudConfig = {
  blockSelfByUser: boolean;
  blockSelfByContact: boolean;
  blockDuplicateContact: boolean;
};

export const DEFAULT_ANTI_FRAUD: AntiFraudConfig = {
  blockSelfByUser: true,
  blockSelfByContact: true,
  blockDuplicateContact: true,
};

const isAntiFraudPayload = (value?: unknown): value is Partial<AntiFraudConfig> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const normalizeAntiFraud = (input?: unknown | null): AntiFraudConfig => {
  const payload = isAntiFraudPayload(input) ? input : undefined;
  return {
    blockSelfByUser: payload?.blockSelfByUser ?? DEFAULT_ANTI_FRAUD.blockSelfByUser,
    blockSelfByContact: payload?.blockSelfByContact ?? DEFAULT_ANTI_FRAUD.blockSelfByContact,
    blockDuplicateContact: payload?.blockDuplicateContact ?? DEFAULT_ANTI_FRAUD.blockDuplicateContact,
  };
};

export const normalizeAllowedServiceIds = (value?: unknown): string[] | null => {
  if (!Array.isArray(value)) return null;
  const ids = value.filter((item) => typeof item === 'string' && item.trim().length > 0);
  return ids.length > 0 ? ids : null;
};

export const formatRewardText = (params: {
  type: RewardType;
  value?: number | null;
  serviceName?: string | null;
}) => {
  const { type, value, serviceName } = params;
  if (type === RewardType.WALLET) {
    const amount = Math.max(0, Number(value ?? 0));
    return `${amount.toFixed(2)}€ de saldo`;
  }
  if (type === RewardType.PERCENT_DISCOUNT) {
    const amount = Math.max(0, Number(value ?? 0));
    return `${amount}% de descuento`;
  }
  if (type === RewardType.FIXED_DISCOUNT) {
    const amount = Math.max(0, Number(value ?? 0));
    return `${amount.toFixed(2)}€ de descuento`;
  }
  return serviceName ? `${serviceName} gratis` : 'Servicio gratis';
};

export const parseContactTokens = (contact?: string | null) => {
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

export const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
export const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
