import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { mapService } from './services.mapper';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const services = await this.prisma.service.findMany({ orderBy: { name: 'asc' } });
    return services.map(mapService);
  }

  async findOne(id: string) {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service) throw new NotFoundException('Service not found');
    return mapService(service);
  }

  async create(data: CreateServiceDto) {
    const created = await this.prisma.service.create({
      data: {
        name: data.name,
        description: data.description || '',
        price: data.price,
        duration: data.duration,
      },
    });
    return mapService(created);
  }

  async update(id: string, data: UpdateServiceDto) {
    const updated = await this.prisma.service.update({ where: { id }, data });
    return mapService(updated);
  }

  async remove(id: string) {
    await this.prisma.service.delete({ where: { id } });
    return { success: true };
  }
}
