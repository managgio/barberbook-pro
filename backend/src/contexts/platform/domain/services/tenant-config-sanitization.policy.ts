export const stripProviderOwnedMessagingConfig = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const sanitized = { ...(value as Record<string, unknown>) };
  delete sanitized.twilio;
  return sanitized;
};
