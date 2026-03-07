export type BookingStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';

export const getInvalidStatusTransitionMessage = (
  currentStatus: BookingStatus,
  nextStatus?: BookingStatus,
): string | null => {
  if (!nextStatus) return null;
  if ((currentStatus === 'no_show' || currentStatus === 'cancelled') && nextStatus === 'completed') {
    return 'Appointment marked as no-show or cancelled cannot be completed.';
  }
  if (currentStatus === 'completed' && nextStatus === 'scheduled') {
    return 'Completed appointment cannot be set to scheduled.';
  }
  return null;
};

export const getCompletionTimingViolationMessage = (params: {
  nextStatus?: BookingStatus;
  now: Date;
  nextStartDateTime: Date;
  durationMinutes: number;
  confirmationGraceMs: number;
}): string | null => {
  if (params.nextStatus !== 'completed') return null;
  const endTime = new Date(params.nextStartDateTime.getTime() + params.durationMinutes * 60 * 1000);
  const confirmationThreshold = new Date(endTime.getTime() + params.confirmationGraceMs);
  if (params.now < confirmationThreshold) {
    return 'Appointment cannot be completed before it ends.';
  }
  return null;
};

export const getCancellationCutoffViolationMessage = (params: {
  isCancelled: boolean;
  isAdminActor: boolean;
  cutoffHours: number;
  nowMs: number;
  nextStartDateTimeMs: number;
}): string | null => {
  if (!params.isCancelled || params.isAdminActor) return null;
  if (params.cutoffHours <= 0) return null;
  const cutoffMs = params.cutoffHours * 60 * 60 * 1000;
  const timeUntil = params.nextStartDateTimeMs - params.nowMs;
  if (timeUntil <= cutoffMs) {
    return `Solo puedes cancelar con más de ${params.cutoffHours}h de antelación.`;
  }
  return null;
};

export const getAdminPermissionViolationMessage = (params: {
  isAdminActor: boolean;
  isPriceModified: boolean;
  isPaymentMethodModified: boolean;
  hasRewardFieldsModified: boolean;
}): string | null => {
  if (params.isAdminActor) return null;
  if (params.isPriceModified) {
    return 'Solo un admin puede modificar el precio final.';
  }
  if (params.isPaymentMethodModified) {
    return 'Solo un admin puede actualizar el método de pago.';
  }
  if (params.hasRewardFieldsModified) {
    return 'Solo un admin puede modificar recompensas.';
  }
  return null;
};
