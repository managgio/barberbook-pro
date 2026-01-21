import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getCurrentLocalId } from '../../tenancy/tenant.context';
import { mapCashMovement } from './cash-register.mapper';
import { CreateCashMovementDto } from './dto/create-cash-movement.dto';
import { UpdateCashMovementDto } from './dto/update-cash-movement.dto';

const startOfDay = (date: string) => new Date(`${date}T00:00:00`);
const endOfDay = (date: string) => new Date(`${date}T23:59:59.999`);

@Injectable()
export class CashRegisterService {
  constructor(private readonly prisma: PrismaService) {}

  async listMovements(date: string) {
    const localId = getCurrentLocalId();
    const from = startOfDay(date);
    const to = endOfDay(date);
    const movements = await this.prisma.cashMovement.findMany({
      where: { localId, occurredAt: { gte: from, lte: to } },
      orderBy: { occurredAt: 'desc' },
    });
    return movements.map(mapCashMovement);
  }

  async createMovement(data: CreateCashMovementDto) {
    const localId = getCurrentLocalId();
    const note = data.note?.trim();
    if (data.type === 'in' && !data.method) {
      throw new BadRequestException('El método de pago es obligatorio para entradas.');
    }
    const occurredAt = data.occurredAt ? new Date(data.occurredAt) : new Date();
    if (Number.isNaN(occurredAt.getTime())) {
      throw new BadRequestException('Fecha inválida para el movimiento.');
    }
    const created = await this.prisma.cashMovement.create({
      data: {
        localId,
        type: data.type,
        amount: new Prisma.Decimal(data.amount),
        method: data.method ?? null,
        note: note || null,
        occurredAt,
      },
    });
    return mapCashMovement(created);
  }

  async updateMovement(id: string, data: UpdateCashMovementDto) {
    const localId = getCurrentLocalId();
    const existing = await this.prisma.cashMovement.findFirst({ where: { id, localId } });
    if (!existing) {
      throw new NotFoundException('Movimiento no encontrado.');
    }
    const nextType = data.type ?? existing.type;
    const nextMethod = data.method === undefined ? existing.method : data.method;
    if (nextType === 'in' && !nextMethod) {
      throw new BadRequestException('El método de pago es obligatorio para entradas.');
    }
    const occurredAt = data.occurredAt ? new Date(data.occurredAt) : undefined;
    if (occurredAt && Number.isNaN(occurredAt.getTime())) {
      throw new BadRequestException('Fecha inválida para el movimiento.');
    }
    const updated = await this.prisma.cashMovement.update({
      where: { id },
      data: {
        type: data.type,
        amount: data.amount !== undefined ? new Prisma.Decimal(data.amount) : undefined,
        method: data.method === undefined ? undefined : data.method,
        note: data.note?.trim() || undefined,
        occurredAt,
      },
    });
    return mapCashMovement(updated);
  }

  async removeMovement(id: string) {
    const localId = getCurrentLocalId();
    const existing = await this.prisma.cashMovement.findFirst({ where: { id, localId } });
    if (!existing) {
      throw new NotFoundException('Movimiento no encontrado.');
    }
    await this.prisma.cashMovement.delete({ where: { id } });
    return { success: true };
  }
}
