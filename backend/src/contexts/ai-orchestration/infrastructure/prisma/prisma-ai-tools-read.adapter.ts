import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  AiToolsReadPort,
  AiToolBarberRecord,
  AiToolServiceRecord,
  AiToolUserRecord,
} from '../../ports/outbound/ai-tools-read.port';

@Injectable()
export class PrismaAiToolsReadAdapter implements AiToolsReadPort {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveBarbers(params: { localId: string }): Promise<Array<{ id: string; name: string }>> {
    return this.prisma.barber.findMany({
      where: {
        localId: params.localId,
        isActive: true,
        isArchived: false,
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async findBarbersByIds(params: { localId: string; barberIds: string[] }): Promise<AiToolBarberRecord[]> {
    if (params.barberIds.length === 0) return [];
    return this.prisma.barber.findMany({
      where: { id: { in: params.barberIds }, localId: params.localId },
      select: { id: true, name: true, isActive: true },
    });
  }

  async findBarbersByName(params: {
    localId: string;
    name: string;
    isActive?: boolean;
    take?: number;
  }): Promise<AiToolBarberRecord[]> {
    return this.prisma.barber.findMany({
      where: {
        name: { contains: params.name },
        localId: params.localId,
        isArchived: false,
        ...(params.isActive === undefined ? {} : { isActive: params.isActive }),
      },
      take: params.take ?? 5,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, isActive: true },
    });
  }

  findBarberById(params: { localId: string; barberId: string }): Promise<AiToolBarberRecord | null> {
    return this.prisma.barber.findFirst({
      where: { id: params.barberId, localId: params.localId, isArchived: false },
      select: { id: true, name: true, isActive: true },
    });
  }

  findBarberNameById(params: { localId: string; barberId: string }): Promise<{ name: string } | null> {
    return this.prisma.barber.findFirst({
      where: { id: params.barberId, localId: params.localId, isArchived: false },
      select: { name: true },
    });
  }

  findServicesCatalog(params: { localId: string }): Promise<AiToolServiceRecord[]> {
    return this.prisma.service.findMany({
      where: { localId: params.localId, isArchived: false },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, duration: true },
    });
  }

  findServiceById(params: { localId: string; serviceId: string }): Promise<AiToolServiceRecord | null> {
    return this.prisma.service.findFirst({
      where: { id: params.serviceId, localId: params.localId, isArchived: false },
      select: { id: true, name: true, duration: true },
    });
  }

  findServicesByName(params: {
    localId: string;
    name: string;
    take?: number;
  }): Promise<AiToolServiceRecord[]> {
    return this.prisma.service.findMany({
      where: { name: { contains: params.name }, localId: params.localId, isArchived: false },
      take: params.take ?? 5,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, duration: true },
    });
  }

  findClientByEmail(params: { brandId: string; email: string }): Promise<{ id: string; name: string } | null> {
    return this.prisma.user.findFirst({
      where: {
        email: params.email,
        role: 'client',
        brandMemberships: { some: { brandId: params.brandId, isBlocked: false } },
      },
      select: { id: true, name: true },
    });
  }

  findClientByPhone(params: { brandId: string; phone: string }): Promise<{ id: string; name: string } | null> {
    return this.prisma.user.findFirst({
      where: {
        phone: params.phone,
        role: 'client',
        brandMemberships: { some: { brandId: params.brandId, isBlocked: false } },
      },
      select: { id: true, name: true },
    });
  }

  async findClientsByNameTerms(params: {
    brandId: string;
    terms: string[];
    take?: number;
  }): Promise<AiToolUserRecord[]> {
    const filteredTerms = params.terms.map((term) => term.trim()).filter(Boolean);
    if (filteredTerms.length === 0) return [];
    const nameFilters = filteredTerms.map((term) => ({ name: { contains: term } }));
    return this.prisma.user.findMany({
      where: {
        role: 'client',
        brandMemberships: { some: { brandId: params.brandId, isBlocked: false } },
        ...(nameFilters.length === 1 ? nameFilters[0] : { OR: nameFilters }),
      },
      select: { id: true, name: true, email: true },
      take: params.take ?? 15,
      orderBy: { name: 'asc' },
    });
  }
}
