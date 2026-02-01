import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { getCurrentLocalId } from '../../tenancy/tenant.context';

const CODE_LENGTH_BYTES = 5;
const MAX_ATTEMPTS = 5;

@Injectable()
export class ReferralCodeService {
  constructor(private readonly prisma: PrismaService) {}

  private generateCode() {
    return randomBytes(CODE_LENGTH_BYTES).toString('hex').toUpperCase();
  }

  async getOrCreateCode(userId: string) {
    const localId = getCurrentLocalId();
    const user = await this.prisma.user.findFirst({ where: { id: userId }, select: { id: true } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const existing = await this.prisma.referralCode.findFirst({ where: { localId, userId } });
    if (existing) return existing;

    let attempt = 0;
    while (attempt < MAX_ATTEMPTS) {
      const code = this.generateCode();
      try {
        return await this.prisma.referralCode.create({
          data: {
            localId,
            userId,
            code,
          },
        });
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

  async resolveCode(code: string) {
    const localId = getCurrentLocalId();
    const referral = await this.prisma.referralCode.findFirst({
      where: { localId, code: code.toUpperCase(), isActive: true },
      include: { user: true },
    });
    if (!referral) throw new NotFoundException('Referral code not found');
    return referral;
  }
}
