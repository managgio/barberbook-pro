export const formatReferralRewardText = (params: {
  type: string;
  value?: number | null;
  serviceName?: string | null;
}) => {
  const { type, value, serviceName } = params;
  if (type === 'WALLET') {
    const amount = Math.max(0, Number(value ?? 0));
    return `${amount.toFixed(2)}€ de saldo`;
  }
  if (type === 'PERCENT_DISCOUNT') {
    const amount = Math.max(0, Number(value ?? 0));
    return `${amount}% de descuento`;
  }
  if (type === 'FIXED_DISCOUNT') {
    const amount = Math.max(0, Number(value ?? 0));
    return `${amount.toFixed(2)}€ de descuento`;
  }
  return serviceName ? `${serviceName} gratis` : 'Servicio gratis';
};

export const startOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);

export const endOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
