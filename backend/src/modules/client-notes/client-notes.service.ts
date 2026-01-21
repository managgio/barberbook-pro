import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getCurrentBrandId, getCurrentLocalId } from '../../tenancy/tenant.context';

const MAX_CLIENT_NOTES = 5;
const MAX_NOTE_LENGTH = 150;

@Injectable()
export class ClientNotesService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeContent(content: string) {
    return content.trim();
  }

  private async ensureClient(userId: string) {
    const brandId = getCurrentBrandId();
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        role: 'client',
        brandMemberships: { some: { brandId } },
      },
    });
    if (!user) {
      throw new NotFoundException('Cliente no encontrado.');
    }
  }

  async listForUser(userId: string) {
    await this.ensureClient(userId);
    const localId = getCurrentLocalId();
    return this.prisma.clientNote.findMany({
      where: { userId, localId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, content: string, authorId: string | null) {
    await this.ensureClient(userId);
    const localId = getCurrentLocalId();
    const trimmed = this.normalizeContent(content);
    if (!trimmed) {
      throw new BadRequestException('La nota no puede estar vacía.');
    }
    if (trimmed.length > MAX_NOTE_LENGTH) {
      throw new BadRequestException(`La nota no puede superar ${MAX_NOTE_LENGTH} caracteres.`);
    }
    const existingCount = await this.prisma.clientNote.count({
      where: { userId, localId },
    });
    if (existingCount >= MAX_CLIENT_NOTES) {
      throw new BadRequestException(`Solo se permiten ${MAX_CLIENT_NOTES} notas por cliente.`);
    }
    return this.prisma.clientNote.create({
      data: {
        localId,
        userId,
        authorId: authorId || null,
        content: trimmed,
      },
    });
  }

  async update(id: string, content: string) {
    const localId = getCurrentLocalId();
    const trimmed = this.normalizeContent(content);
    if (!trimmed) {
      throw new BadRequestException('La nota no puede estar vacía.');
    }
    if (trimmed.length > MAX_NOTE_LENGTH) {
      throw new BadRequestException(`La nota no puede superar ${MAX_NOTE_LENGTH} caracteres.`);
    }
    const existing = await this.prisma.clientNote.findFirst({ where: { id, localId } });
    if (!existing) {
      throw new NotFoundException('Nota no encontrada.');
    }
    return this.prisma.clientNote.update({
      where: { id },
      data: { content: trimmed },
    });
  }

  async remove(id: string) {
    const localId = getCurrentLocalId();
    const existing = await this.prisma.clientNote.findFirst({ where: { id, localId } });
    if (!existing) {
      throw new NotFoundException('Nota no encontrada.');
    }
    await this.prisma.clientNote.delete({ where: { id } });
    return { success: true };
  }
}
