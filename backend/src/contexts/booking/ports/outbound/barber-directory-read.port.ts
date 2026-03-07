import { BarberDirectoryEntry } from '../../domain/entities/barber-directory.entity';

export const BOOKING_BARBER_DIRECTORY_READ_PORT = Symbol('BOOKING_BARBER_DIRECTORY_READ_PORT');

export interface BarberDirectoryReadPort {
  listBarbers(params: {
    localId: string;
    serviceId?: string;
    includeInactive?: boolean;
  }): Promise<BarberDirectoryEntry[]>;
  getBarberById(params: { localId: string; barberId: string }): Promise<BarberDirectoryEntry | null>;
}
