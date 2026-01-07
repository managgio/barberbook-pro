import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { mapAlert } from './alerts.mapper';

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  private validateDates(data: { startDate?: string; endDate?: string }) {
    if (data.startDate && data.endDate && new Date(data.startDate) > new Date(data.endDate)) {
      throw new BadRequestException('La fecha de inicio no puede ser posterior a la fecha de fin.');
    }
  }

  async findAll() {
    const alerts = await this.prisma.alert.findMany({ orderBy: { createdAt: 'desc' } });
    return alerts.map(mapAlert);
  }

  async findActive() {
    const now = new Date();
    const alerts = await this.prisma.alert.findMany({
      where: {
        active: true,
        OR: [{ startDate: null }, { startDate: { lte: now } }],
        AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
      },
      orderBy: { createdAt: 'desc' },
    });
    return alerts.map(mapAlert);
  }

  async create(data: CreateAlertDto) {
    this.validateDates(data);
    const created = await this.prisma.alert.create({
      data: {
        title: data.title,
        message: data.message,
        active: data.active ?? true,
        type: data.type || 'info',
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
      },
    });
    return mapAlert(created);
  }

  async update(id: string, data: UpdateAlertDto) {
    this.validateDates(data);
    try {
      const updated = await this.prisma.alert.update({
        where: { id },
        data: {
          title: data.title,
          message: data.message,
          active: data.active,
          type: data.type,
          startDate: data.startDate ? new Date(data.startDate) : null,
          endDate: data.endDate ? new Date(data.endDate) : null,
        },
      });
      return mapAlert(updated);
    } catch (error) {
      throw new NotFoundException('Alert not found');
    }
  }

  async remove(id: string) {
    await this.prisma.alert.delete({ where: { id } });
    return { success: true };
  }
}
