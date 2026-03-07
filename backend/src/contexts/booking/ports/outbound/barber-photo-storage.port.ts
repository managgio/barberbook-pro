export const BOOKING_BARBER_PHOTO_STORAGE_PORT = Symbol('BOOKING_BARBER_PHOTO_STORAGE_PORT');

export interface BarberPhotoStoragePort {
  deletePhotoFile(params: { barberId: string; fileId: string }): Promise<void>;
}
