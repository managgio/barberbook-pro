import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../../auth/auth.service';
import { ReferralAttributionService } from './referral-attribution.service';
import { ReferralCodeService } from './referral-code.service';
import { AttributeReferralDto } from './dto/attribute-referral.dto';

@Controller('referrals')
export class ReferralsPublicController {
  constructor(
    private readonly authService: AuthService,
    private readonly attributionService: ReferralAttributionService,
    private readonly referralCodeService: ReferralCodeService,
  ) {}

  private async assertReferralOwner(req: Request | undefined, userId: string) {
    const actor = await this.authService.requireUser(req);
    if (actor.id === userId || actor.isSuperAdmin || actor.isPlatformAdmin) {
      return actor;
    }
    throw new ForbiddenException('No tienes permisos para consultar este recurso.');
  }

  @Get('my-code')
  async getMyCode(@Query('userId') userId?: string, @Req() req?: Request) {
    if (!userId) throw new BadRequestException('userId is required');
    await this.assertReferralOwner(req, userId);
    const code = await this.referralCodeService.getOrCreateCode(userId);
    const rewardSummary = await this.attributionService.getRewardSummaryPayload();
    const originHeader = typeof req?.headers?.origin === 'string' ? req?.headers?.origin : null;
    const forwardedProto = typeof req?.headers?.['x-forwarded-proto'] === 'string' ? req?.headers?.['x-forwarded-proto'] : null;
    const hostHeader = (req?.headers?.['x-forwarded-host'] || req?.headers?.host) as string | undefined;
    const protocol = (originHeader ? null : forwardedProto || req?.protocol) || 'https';
    const baseUrl = originHeader || (hostHeader ? `${protocol}://${hostHeader}` : null);
    const shareUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/ref/${code.code}` : null;
    return {
      code: code.code,
      rewardSummary,
      shareUrl,
      qrUrlPayload: shareUrl,
    };
  }

  @Get('my-summary')
  async getMySummary(@Req() req: Request, @Query('userId') userId?: string) {
    if (!userId) throw new BadRequestException('userId is required');
    await this.assertReferralOwner(req, userId);
    return this.attributionService.getReferrerSummary(userId);
  }

  @Get('resolve/:code')
  resolve(@Param('code') code: string) {
    return this.attributionService.resolveReferral(code);
  }

  @Post('attribute')
  attribute(@Body() data: AttributeReferralDto) {
    return this.attributionService.attributeReferral(data);
  }
}
