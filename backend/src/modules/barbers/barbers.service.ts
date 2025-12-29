import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBarberDto } from './dto/create-barber.dto';
import { UpdateBarberDto } from './dto/update-barber.dto';
import { mapBarber } from './barbers.mapper';

const parseDate = (value?: string | null) => (value ? new Date(value) : null);

@Injectable()
export class BarbersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const barbers = await this.prisma.barber.findMany({ orderBy: { name: 'asc' } });
    return barbers.map(mapBarber);
  }

  async findOne(id: string) {
    const barber = await this.prisma.barber.findUnique({ where: { id } });
    if (!barber) throw new NotFoundException('Barber not found');
    return mapBarber(barber);
  }

  async create(data: CreateBarberDto) {
    const created = await this.prisma.barber.create({
      data: {
        name: data.name,
        photo: data.photo,
        photoFileId: data.photoFileId,
        specialty: data.specialty,
        role: data.role || 'worker',
        bio: data.bio,
        startDate: parseDate(data.startDate) || new Date(),
        endDate: parseDate(data.endDate),
        isActive: data.isActive ?? true,
        userId: data.userId,
      },
    });
    return mapBarber(created);
  }

  async update(id: string, data: UpdateBarberDto) {
    const updated = await this.prisma.barber.update({
      where: { id },
      data: {
        name: data.name,
        photo: data.photo ?? undefined,
        photoFileId: data.photoFileId ?? undefined,
        specialty: data.specialty,
        role: data.role,
        bio: data.bio ?? undefined,
        startDate: data.startDate ? parseDate(data.startDate) || undefined : undefined,
        endDate: data.endDate === '' ? null : parseDate(data.endDate),
        isActive: data.isActive,
        userId: data.userId ?? undefined,
      },
    });
    return mapBarber(updated);
  }

  async remove(id: string) {
    await this.prisma.barber.delete({ where: { id } });
    return { success: true };
  }
}
