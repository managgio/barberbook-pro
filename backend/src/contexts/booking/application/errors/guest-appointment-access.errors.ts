import { DomainError } from '../../../../shared/domain/domain-error';
import { GuestAppointmentCancellationUnavailableReason } from '../../domain/services/guest-appointment-access.policy';

export class GuestAppointmentAccessUnavailableError extends DomainError {
  constructor() {
    super('Guest appointment access is unavailable', 'GUEST_APPOINTMENT_ACCESS_UNAVAILABLE');
  }
}

export class GuestAppointmentAccessNotFoundError extends DomainError {
  constructor() {
    super('Guest appointment access was not found', 'GUEST_APPOINTMENT_ACCESS_NOT_FOUND');
  }
}

export class GuestAppointmentCannotCancelError extends DomainError {
  constructor(readonly reason: GuestAppointmentCancellationUnavailableReason | 'operation_in_progress') {
    super('Guest appointment cannot be cancelled', 'GUEST_APPOINTMENT_CANNOT_CANCEL');
  }
}
