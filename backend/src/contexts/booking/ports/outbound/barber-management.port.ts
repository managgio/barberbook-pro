import { BarberDirectoryEntry } from '../../domain/entities/barber-directory.entity';

export const BOOKING_BARBER_MANAGEMENT_PORT = Symbol('BOOKING_BARBER_MANAGEMENT_PORT');

export type CreateBarberInput = {
  name: string;
  photo?: string;
  photoFileId?: string | null;
  specialty: string;
  role?: string;
  bio?: string;
  startDate: string;
  endDate?: string | null;
  isActive?: boolean;
  calendarColor?: string;
  userId?: string;
};

export type UpdateBarberInput = {
  name?: string;
  photo?: string | null;
  photoFileId?: string | null;
  specialty?: string;
  role?: string;
  bio?: string | null;
  startDate?: string;
  endDate?: string | null;
  isActive?: boolean;
  calendarColor?: string;
  userId?: string | null;
};

export type UpdateBarberServiceAssignmentInput = {
  serviceIds?: string[];
  categoryIds?: string[];
};

export type RemoveBarberResult = {
  archived: boolean;
  photoFileId: string | null;
};

export interface BarberManagementPort {
  createBarber(params: { localId: string; input: CreateBarberInput }): Promise<BarberDirectoryEntry>;
  updateBarber(params: {
    localId: string;
    barberId: string;
    input: UpdateBarberInput;
  }): Promise<BarberDirectoryEntry | null>;
  updateBarberServiceAssignment(params: {
    localId: string;
    barberId: string;
    input: UpdateBarberServiceAssignmentInput;
  }): Promise<BarberDirectoryEntry | null>;
  removeBarber(params: { localId: string; barberId: string }): Promise<RemoveBarberResult | null>;
}
