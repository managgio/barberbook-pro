import { Service, ServiceCategory } from '@prisma/client';
import { mapService } from '../services/services.mapper';

type ServiceCategoryWithServices = ServiceCategory & { services?: (Service & { category?: ServiceCategory | null })[] };

export const mapServiceCategory = (
  category: ServiceCategoryWithServices,
  options: { includeServices?: boolean } = {},
) => ({
  id: category.id,
  name: category.name,
  description: category.description ?? '',
  position: category.position,
  services:
    options.includeServices === false || !category.services
      ? undefined
      : category.services.map((service) => mapService(service)),
});
