import { Service } from '@prisma/client';

export const mapService = (service: Service) => ({
  id: service.id,
  name: service.name,
  description: service.description,
  price: parseFloat(service.price.toString()),
  duration: service.duration,
});
