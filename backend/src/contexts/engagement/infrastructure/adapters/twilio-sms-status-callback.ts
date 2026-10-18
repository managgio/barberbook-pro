export const SMS_STATUS_DELIVERY_REFERENCE_QUERY = 'deliveryId';

export const buildTwilioSmsStatusCallbackUrl = (
  baseUrl: string,
  deliveryReference: string,
): string => {
  const callbackUrl = new URL(baseUrl);
  callbackUrl.searchParams.set(SMS_STATUS_DELIVERY_REFERENCE_QUERY, deliveryReference);
  return callbackUrl.toString();
};
