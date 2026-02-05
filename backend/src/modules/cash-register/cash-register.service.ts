import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CashMovementProductOperationType,
  CashMovementType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getCurrentLocalId } from '../../tenancy/tenant.context';
import { getProductSettings } from '../products/products.utils';
import { mapCashMovement } from './cash-register.mapper';
import { CreateCashMovementDto } from './dto/create-cash-movement.dto';
import { UpdateCashMovementDto } from './dto/update-cash-movement.dto';

const startOfDay = (date: string) => new Date(`${date}T00:00:00`);
const endOfDay = (date: string) => new Date(`${date}T23:59:59.999`);

@Injectable()
export class CashRegisterService {
  constructor(private readonly prisma: PrismaService) {}

  private getOperationMovementType(operation: CashMovementProductOperationType): CashMovementType {
    return operation === 'sale' ? 'in' : 'out';
  }

  private normalizeProductItems(items?: CreateCashMovementDto['productItems']) {
    if (!Array.isArray(items)) return [];
    const collapsed = new Map<string, { quantity: number; unitAmount?: number }>();
    for (const item of items) {
      const productId = item.productId?.trim();
      const quantity = Number(item.quantity);
      if (!productId || !Number.isInteger(quantity) || quantity <= 0) {
        throw new BadRequestException('Cada producto debe tener id válido y cantidad mayor que cero.');
      }
      const parsedUnitAmount =
        item.unitAmount === undefined ? undefined : Number(item.unitAmount);
      if (
        parsedUnitAmount !== undefined &&
        (!Number.isFinite(parsedUnitAmount) || parsedUnitAmount < 0)
      ) {
        throw new BadRequestException('El precio unitario de los productos debe ser válido.');
      }
      const current = collapsed.get(productId);
      if (!current) {
        collapsed.set(productId, {
          quantity,
          unitAmount: parsedUnitAmount,
        });
        continue;
      }
      collapsed.set(productId, {
        quantity: current.quantity + quantity,
        unitAmount:
          parsedUnitAmount === undefined ? current.unitAmount : parsedUnitAmount,
      });
    }
    return Array.from(collapsed.entries()).map(([productId, value]) => ({
      productId,
      quantity: value.quantity,
      unitAmount: value.unitAmount,
    }));
  }

  private async resolveProductItems(
    tx: Prisma.TransactionClient,
    localId: string,
    inputItems: Array<{ productId: string; quantity: number; unitAmount?: number }>,
  ) {
    if (inputItems.length === 0) return [];
    const products = await tx.product.findMany({
      where: {
        id: { in: inputItems.map((item) => item.productId) },
        localId,
        isArchived: false,
      },
      select: {
        id: true,
        name: true,
        price: true,
        stock: true,
      },
    });
    if (products.length !== inputItems.length) {
      throw new BadRequestException(
        'Uno o varios productos no existen, están archivados o no pertenecen a este local.',
      );
    }
    const productById = new Map(products.map((product) => [product.id, product]));
    return inputItems.map((item) => {
      const product = productById.get(item.productId)!;
      const resolvedUnitAmount =
        item.unitAmount === undefined ? Number(product.price) : Number(item.unitAmount);
      return {
        productId: product.id,
        productNameSnapshot: product.name,
        quantity: item.quantity,
        unitAmount: resolvedUnitAmount,
        availableStock: product.stock,
      };
    });
  }

  private async applyStockForOperation(
    tx: Prisma.TransactionClient,
    operation: CashMovementProductOperationType,
    items: Array<{
      productId: string;
      quantity: number;
      availableStock?: number;
      productNameSnapshot: string;
    }>,
    options?: { reverse?: boolean },
  ) {
    const reverse = options?.reverse === true;
    const effectiveOperation = reverse
      ? operation === 'sale'
        ? 'purchase'
        : 'sale'
      : operation;

    if (effectiveOperation === 'sale') {
      for (const item of items) {
        const stock =
          item.availableStock ??
          (
            await tx.product.findUnique({
              where: { id: item.productId },
              select: { stock: true },
            })
          )?.stock;
        if (stock === undefined || stock < item.quantity) {
          throw new BadRequestException(
            `Stock insuficiente para "${item.productNameSnapshot}".`,
          );
        }
      }
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }
      return;
    }

    for (const item of items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
    }
  }

  async listMovements(date: string) {
    const localId = getCurrentLocalId();
    const from = startOfDay(date);
    const to = endOfDay(date);
    const movements = await this.prisma.cashMovement.findMany({
      where: { localId, occurredAt: { gte: from, lte: to } },
      orderBy: { occurredAt: 'desc' },
      include: {
        productItems: {
          include: {
            product: {
              select: { name: true },
            },
          },
        },
      },
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
    const operation = data.productOperationType;
    const normalizedProductItems = this.normalizeProductItems(data.productItems);

    if (operation) {
      const settings = await getProductSettings(this.prisma);
      if (!settings.enabled) {
        throw new BadRequestException(
          'El control de productos no está habilitado en este local.',
        );
      }
      if (normalizedProductItems.length === 0) {
        throw new BadRequestException(
          'Selecciona al menos un producto para registrar compra o venta.',
        );
      }
      const requiredType = this.getOperationMovementType(operation);
      if (data.type !== requiredType) {
        throw new BadRequestException(
          operation === 'sale'
            ? 'Una venta de productos debe registrarse como entrada.'
            : 'Una compra de productos debe registrarse como salida.',
        );
      }
    } else if (normalizedProductItems.length > 0) {
      throw new BadRequestException(
        'Los productos solo pueden añadirse en movimientos de compra o venta.',
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const resolvedProductItems = operation
        ? await this.resolveProductItems(tx, localId, normalizedProductItems)
        : [];

      if (operation === 'sale') {
        for (const item of resolvedProductItems) {
          if (item.availableStock < item.quantity) {
            throw new BadRequestException(
              `Stock insuficiente para "${item.productNameSnapshot}".`,
            );
          }
        }
      }

      const movement = await tx.cashMovement.create({
        data: {
          localId,
          type: data.type,
          amount: new Prisma.Decimal(data.amount),
          method: data.method ?? null,
          note: note || null,
          occurredAt,
          productOperationType: operation ?? null,
          productItems:
            resolvedProductItems.length > 0
              ? {
                  create: resolvedProductItems.map((item) => ({
                    productId: item.productId,
                    productNameSnapshot: item.productNameSnapshot,
                    quantity: item.quantity,
                    unitAmount: new Prisma.Decimal(item.unitAmount),
                  })),
                }
              : undefined,
        },
        include: {
          productItems: {
            include: {
              product: {
                select: { name: true },
              },
            },
          },
        },
      });

      if (operation && resolvedProductItems.length > 0) {
        await this.applyStockForOperation(tx, operation, resolvedProductItems);
      }
      return movement;
    });
    return mapCashMovement(created);
  }

  async updateMovement(id: string, data: UpdateCashMovementDto) {
    const localId = getCurrentLocalId();
    const existing = await this.prisma.cashMovement.findFirst({
      where: { id, localId },
      include: { productItems: true },
    });
    if (!existing) {
      throw new NotFoundException('Movimiento no encontrado.');
    }
    if (existing.productOperationType || existing.productItems.length > 0) {
      throw new BadRequestException(
        'Los movimientos de compra/venta de productos no se pueden editar.',
      );
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
      include: {
        productItems: {
          include: {
            product: {
              select: { name: true },
            },
          },
        },
      },
    });
    return mapCashMovement(updated);
  }

  async removeMovement(id: string) {
    const localId = getCurrentLocalId();
    const existing = await this.prisma.cashMovement.findFirst({
      where: { id, localId },
      include: {
        productItems: true,
      },
    });
    if (!existing) {
      throw new NotFoundException('Movimiento no encontrado.');
    }
    await this.prisma.$transaction(async (tx) => {
      if (existing.productOperationType && existing.productItems.length > 0) {
        const existingIds = existing.productItems
          .map((item) => item.productId)
          .filter((value): value is string => Boolean(value));
        const currentProducts = existingIds.length
          ? await tx.product.findMany({
              where: { id: { in: existingIds }, localId },
              select: { id: true, stock: true },
            })
          : [];
        const stockByProductId = new Map(currentProducts.map((item) => [item.id, item.stock]));

        const grouped = new Map<
          string,
          { productId: string; productNameSnapshot: string; quantity: number; availableStock: number }
        >();
        for (const item of existing.productItems) {
          if (!item.productId || !stockByProductId.has(item.productId)) continue;
          const current = grouped.get(item.productId);
          if (!current) {
            grouped.set(item.productId, {
              productId: item.productId,
              productNameSnapshot: item.productNameSnapshot,
              quantity: item.quantity,
              availableStock: stockByProductId.get(item.productId) ?? 0,
            });
            continue;
          }
          grouped.set(item.productId, {
            ...current,
            quantity: current.quantity + item.quantity,
          });
        }
        const reversibleItems = Array.from(grouped.values());

        await this.applyStockForOperation(
          tx,
          existing.productOperationType,
          reversibleItems,
          { reverse: true },
        );
      }

      await tx.cashMovement.delete({ where: { id } });
    });
    return { success: true };
  }
}
