import { Barber, Service } from '@/data/types';

export const isBarberEligibleForService = (
  barber: Barber,
  service: Service | null | undefined,
  assignmentEnabled: boolean,
) => {
  if (!assignmentEnabled || !service) return true;

  const assignedServiceIds = barber.assignedServiceIds || [];
  const assignedCategoryIds = barber.assignedCategoryIds || [];
  const hasAnyAssignment =
    typeof barber.hasAnyServiceAssignment === 'boolean'
      ? barber.hasAnyServiceAssignment
      : assignedServiceIds.length > 0 || assignedCategoryIds.length > 0;

  if (!hasAnyAssignment) return true;
  if (assignedServiceIds.includes(service.id)) return true;
  if (service.categoryId && assignedCategoryIds.includes(service.categoryId)) return true;
  return false;
};
