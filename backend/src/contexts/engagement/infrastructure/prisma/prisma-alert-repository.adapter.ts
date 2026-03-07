import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { AlertEntity } from '../../domain/entities/alert.entity';
import {
  AlertRepositoryPort,
  CreateAlertInput,
  UpdateAlertInput,
} from '../../ports/outbound/alert-repository.port';

const mapAlertEntity = (alert: {
  id: string;
  localId: string;
  title: string;
  message: string;
  active: boolean;
  type: string;
  startDate: Date | null;
  endDate: Date | null;
}): AlertEntity => ({
  id: alert.id,
  localId: alert.localId,
  title: alert.title,
  message: alert.message,
  active: alert.active,
  type: alert.type,
  startDate: alert.startDate,
  endDate: alert.endDate,
});

@Injectable()
export class PrismaAlertRepositoryAdapter implements AlertRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async listByLocalId(localId: string): Promise<AlertEntity[]> {
    const alerts = await this.prisma.alert.findMany({
      where: { localId },
      orderBy: { createdAt: 'desc' },
    });
    return alerts.map(mapAlertEntity);
  }

  async listActiveByLocalId(params: { localId: string; now: Date }): Promise<AlertEntity[]> {
    const alerts = await this.prisma.alert.findMany({
      where: {
        localId: params.localId,
        active: true,
        OR: [{ startDate: null }, { startDate: { lte: params.now } }],
        AND: [{ OR: [{ endDate: null }, { endDate: { gte: params.now } }] }],
      },
      orderBy: { createdAt: 'desc' },
    });
    return alerts.map(mapAlertEntity);
  }

  async create(input: CreateAlertInput): Promise<AlertEntity> {
    const created = await this.prisma.alert.create({
      data: {
        localId: input.localId,
        title: input.title,
        message: input.message,
        active: input.active,
        type: input.type as any,
        startDate: input.startDate,
        endDate: input.endDate,
      },
    });
    return mapAlertEntity(created);
  }

  async findByIdAndLocalId(params: { id: string; localId: string }): Promise<AlertEntity | null> {
    const found = await this.prisma.alert.findFirst({
      where: {
        id: params.id,
        localId: params.localId,
      },
    });
    return found ? mapAlertEntity(found) : null;
  }

  async updateById(id: string, input: UpdateAlertInput): Promise<AlertEntity> {
    const updated = await this.prisma.alert.update({
      where: { id },
      data: {
        title: input.title,
        message: input.message,
        active: input.active,
        type: input.type as any,
        startDate: input.startDate,
        endDate: input.endDate,
      },
    });
    return mapAlertEntity(updated);
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.alert.delete({
      where: { id },
    });
  }
}

