export const BOOKING_BARBER_ASSIGNMENT_POLICY_READ_PORT = Symbol('BOOKING_BARBER_ASSIGNMENT_POLICY_READ_PORT');

export interface BarberAssignmentPolicyReadPort {
  isBarberServiceAssignmentEnabled(): Promise<boolean>;
}
