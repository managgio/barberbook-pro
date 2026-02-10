export const BARBER_COLOR_PALETTE = [
  '#f59e0b',
  '#3b82f6',
  '#22c55e',
  '#a855f7',
  '#ec4899',
  '#14b8a6',
  '#ef4444',
  '#6366f1',
] as const;

export const normalizeBarberColor = (value?: string | null) => {
  if (!value) return null;
  const normalized = value.trim();
  return /^#[0-9A-Fa-f]{6}$/.test(normalized) ? normalized.toLowerCase() : null;
};

const resolveHashColor = (barberId: string) => {
  let hash = 0;
  for (let i = 0; i < barberId.length; i += 1) {
    hash = (hash << 5) - hash + barberId.charCodeAt(i);
    hash |= 0;
  }
  return BARBER_COLOR_PALETTE[Math.abs(hash) % BARBER_COLOR_PALETTE.length];
};

export const resolveBarberAccentColor = (barberId: string, assignedColor?: string | null) =>
  normalizeBarberColor(assignedColor) || resolveHashColor(barberId);
