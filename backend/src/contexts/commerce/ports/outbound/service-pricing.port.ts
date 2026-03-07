export const COMMERCE_SERVICE_PRICING_PORT = Symbol('COMMERCE_SERVICE_PRICING_PORT');

export type CommerceServicePricingResult = {
  serviceName: string;
  basePrice: number;
  finalPrice: number;
  appliedOfferId: string | null;
};

export interface CommerceServicePricingPort {
  calculateServicePrice(params: {
    localId: string;
    serviceId: string;
    referenceDate: Date;
  }): Promise<CommerceServicePricingResult>;
}
