import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  EngagementReferralCodeManagementPort,
  EngagementReferralCodePayload,
  EngagementResolvedReferralCodePayload,
} from '../../../contexts/engagement/ports/outbound/referral-code-management.port';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../../contexts/platform/ports/outbound/tenant-context.port';
import { PrismaService } from '../../../prisma/prisma.service';

const CODE_LENGTH_BYTES = 5;
const MAX_ATTEMPTS = 5;

@Injectable()
export class PrismaReferralCodeManagementAdapter implements EngagementReferralCodeManagementPort {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {}

  private generateCode() {
    return randomBytes(CODE_LENGTH_BYTES).toString('hex').toUpperCase();
  }

  private getLocalId() {
    return this.tenantContextPort.getRequestContext().localId;
  }

  private normalizeCodePayload(record: {
    id: string;
    localId: string;
    userId: string;
    code: string;
    isActive: boolean;
  }): EngagementReferralCodePayload {
    return {
      id: record.id,
      localId: record.localId,
      userId: record.userId,
      code: record.code,
      isActive: record.isActive,
    };
  }

  async getOrCreateCode(userId: string): Promise<EngagementReferralCodePayload> {
    const localId = this.getLocalId();
    const user = await this.prisma.user.findFirst({ where: { id: userId }, select: { id: true } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const existing = await this.prisma.referralCode.findFirst({ where: { localId, userId } });
    if (existing) return this.normalizeCodePayload(existing);

    let attempt = 0;
    while (attempt < MAX_ATTEMPTS) {
      const code = this.generateCode();
      try {
        const created = await this.prisma.referralCode.create({
          data: {
            localId,
            userId,
            code,
          },
        });
        return this.normalizeCodePayload(created);
      } catch (error: any) {
        if (error?.code === 'P2002') {
          attempt += 1;
          continue;
        }
        throw error;
      }
    }
    throw new Error('Unable to generate referral code');
  }

  async resolveCode(code: string): Promise<EngagementResolvedReferralCodePayload> {
    const localId = this.getLocalId();
    const referral = await this.prisma.referralCode.findFirst({
      where: { localId, code: code.toUpperCase(), isActive: true },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });
    if (!referral) throw new NotFoundException('Referral code not found');

    return {
      ...this.normalizeCodePayload(referral),
      user: {
        id: referral.user.id,
        name: referral.user.name ?? null,
        email: referral.user.email ?? null,
        phone: referral.user.phone ?? null,
      },
    };
  }
}
