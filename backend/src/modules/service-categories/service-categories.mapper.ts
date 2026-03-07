import { mapService } from '../services/services.mapper';

type ServiceCategoryWithServices = {
  id: string;
  name: string;
  description: string | null;
  position: number;
  services?: unknown[];
};

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
      : category.services.map((service) => mapService(service as any)),
});
