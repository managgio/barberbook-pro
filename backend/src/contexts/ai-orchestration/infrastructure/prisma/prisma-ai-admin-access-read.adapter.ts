import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { AiAdminAccessReadPort } from '../../ports/outbound/ai-admin-access-read.port';

@Injectable()
export class PrismaAiAdminAccessReadAdapter implements AiAdminAccessReadPort {
  constructor(private readonly prisma: PrismaService) {}

  findUserById(params: { userId: string }) {
    return this.prisma.user.findUnique({
      where: { id: params.userId },
      select: { id: true, isSuperAdmin: true, isPlatformAdmin: true },
    });
  }

  async hasLocationStaffMembership(params: { localId: string; userId: string }) {
    const staff = await this.prisma.locationStaff.findUnique({
      where: {
        localId_userId: {
          localId: params.localId,
          userId: params.userId,
        },
      },
      select: { userId: true },
    });
    return Boolean(staff);
  }
}
