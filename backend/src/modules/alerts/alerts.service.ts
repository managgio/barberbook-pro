import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getCurrentLocalId } from '../../tenancy/tenant.context';
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
    const localId = getCurrentLocalId();
    const alerts = await this.prisma.alert.findMany({
      where: { localId },
      orderBy: { createdAt: 'desc' },
    });
    return alerts.map(mapAlert);
  }

  async findActive() {
    const now = new Date();
    const localId = getCurrentLocalId();
    const alerts = await this.prisma.alert.findMany({
      where: {
        localId,
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
    const localId = getCurrentLocalId();
    const created = await this.prisma.alert.create({
      data: {
        localId,
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
    const localId = getCurrentLocalId();
    const existing = await this.prisma.alert.findFirst({ where: { id, localId } });
    if (!existing) throw new NotFoundException('Alert not found');

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
  }

  async remove(id: string) {
    const localId = getCurrentLocalId();
    const existing = await this.prisma.alert.findFirst({ where: { id, localId } });
    if (!existing) throw new NotFoundException('Alert not found');
    await this.prisma.alert.delete({ where: { id } });
    return { success: true };
  }
}
