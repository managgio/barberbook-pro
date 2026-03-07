import { DomainError } from '../../../../shared/domain/domain-error';

export const parseAlertDateRangeOrThrow = (params: { startDate?: string; endDate?: string }) => {
  const startDate = params.startDate ? new Date(params.startDate) : null;
  const endDate = params.endDate ? new Date(params.endDate) : null;

  if (startDate && Number.isNaN(startDate.getTime())) {
    throw new DomainError('Invalid startDate', 'ALERT_INVALID_DATE');
  }
  if (endDate && Number.isNaN(endDate.getTime())) {
    throw new DomainError('Invalid endDate', 'ALERT_INVALID_DATE');
  }
  if (startDate && endDate && startDate > endDate) {
    throw new DomainError('Start date cannot be after end date', 'ALERT_INVALID_DATE_RANGE');
  }

  return {
    startDate,
    endDate,
  };
};

