export const BARBER_ELIGIBILITY_READ_PORT = Symbol('BARBER_ELIGIBILITY_READ_PORT');

export type BarberAvailabilitySnapshot = {
  id: string;
  isActive: boolean;
  startDate: Date | null;
  endDate: Date | null;
};

export interface BarberEligibilityReadPort {
  getBarber(params: { localId: string; barberId: string }): Promise<BarberAvailabilitySnapshot | null>;
  getBarbers(params: { localId: string; barberIds: string[] }): Promise<BarberAvailabilitySnapshot[]>;
  isBarberAllowedForService(params: { localId: string; barberId: string; serviceId: string }): Promise<boolean>;
  getEligibleBarberIdsForService(params: { localId: string; serviceId: string; barberIds: string[] }): Promise<string[]>;
}
