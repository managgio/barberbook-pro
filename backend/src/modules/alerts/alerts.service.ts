import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { mapAlert } from './alerts.mapper';

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const alerts = await this.prisma.alert.findMany({ orderBy: { createdAt: 'desc' } });
    return alerts.map(mapAlert);
  }

  async findActive() {
    const alerts = await this.prisma.alert.findMany({ where: { active: true }, orderBy: { createdAt: 'desc' } });
    return alerts.map(mapAlert);
  }

  async create(data: CreateAlertDto) {
    const created = await this.prisma.alert.create({
      data: {
        title: data.title,
        message: data.message,
        active: data.active ?? true,
        type: data.type || 'info',
      },
    });
    return mapAlert(created);
  }

  async update(id: string, data: UpdateAlertDto) {
    try {
      const updated = await this.prisma.alert.update({ where: { id }, data });
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
