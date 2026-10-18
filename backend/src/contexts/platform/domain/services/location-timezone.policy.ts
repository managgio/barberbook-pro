export const DEFAULT_LOCATION_TIMEZONE = 'Europe/Madrid';

export const canonicalizeIanaTimeZone = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > 64) return null;

  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: normalized })
      .resolvedOptions()
      .timeZone;
  } catch {
    return null;
  }
};

export const isValidIanaTimeZone = (value: unknown): value is string =>
  canonicalizeIanaTimeZone(value) !== null;

export const resolveLocationTimeZone = (
  value: unknown,
  fallback: unknown = DEFAULT_LOCATION_TIMEZONE,
): string =>
  canonicalizeIanaTimeZone(value)
  ?? canonicalizeIanaTimeZone(fallback)
  ?? DEFAULT_LOCATION_TIMEZONE;
