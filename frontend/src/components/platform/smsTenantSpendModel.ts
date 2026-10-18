import { PlatformMessagingTenantUsage } from '@/data/types';

const TENANT_COLORS = [
  '#f97316',
  '#0ea5e9',
  '#8b5cf6',
  '#22c55e',
  '#eab308',
  '#ec4899',
  '#14b8a6',
  '#6366f1',
];

export type SmsTenantSpendRow = PlatformMessagingTenantUsage & {
  sharePercentage: number;
  color: string;
};

export const buildSmsTenantSpendRows = (items: PlatformMessagingTenantUsage[]) => {
  const normalized = items
    .map((item) => ({
      ...item,
      costUsd: Number.isFinite(item.costUsd) ? Math.max(item.costUsd, 0) : 0,
      messagesCount: Number.isFinite(item.messagesCount) ? Math.max(item.messagesCount, 0) : 0,
    }))
    .filter((item) => item.costUsd > 0 || item.messagesCount > 0)
    .sort((left, right) => (
      right.costUsd - left.costUsd
      || right.messagesCount - left.messagesCount
      || left.brandName.localeCompare(right.brandName)
    ));
  const totalCostUsd = normalized.reduce((total, item) => total + item.costUsd, 0);
  const totalMessages = normalized.reduce((total, item) => total + item.messagesCount, 0);
  const rows: SmsTenantSpendRow[] = normalized.map((item, index) => ({
    ...item,
    sharePercentage: totalCostUsd > 0 ? (item.costUsd / totalCostUsd) * 100 : 0,
    color: TENANT_COLORS[index % TENANT_COLORS.length],
  }));
  return { rows, totalCostUsd, totalMessages };
};
