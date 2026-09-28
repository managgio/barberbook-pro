export type BookingSubmitErrorKind = 'slot_conflict' | 'staff_mismatch' | 'unexpected';

export const classifyBookingSubmitError = (message: string): BookingSubmitErrorKind => {
  const normalized = message.toLocaleLowerCase('es');
  if (normalized.includes('horario no disponible')) return 'slot_conflict';
  if (normalized.includes('no está disponible para este servicio')) return 'staff_mismatch';
  return 'unexpected';
};
