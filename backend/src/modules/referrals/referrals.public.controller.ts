import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { ReferralAttributionService } from './referral-attribution.service';
import { ReferralCodeService } from './referral-code.service';
import { AttributeReferralDto } from './dto/attribute-referral.dto';

@Controller('referrals')
export class ReferralsPublicController {
  constructor(
    private readonly attributionService: ReferralAttributionService,
    private readonly referralCodeService: ReferralCodeService,
  ) {}

  @Get('my-code')
  async getMyCode(@Query('userId') userId?: string, @Req() req?: Request) {
    if (!userId) throw new BadRequestException('userId is required');
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
  async getMySummary(@Query('userId') userId?: string) {
    if (!userId) throw new BadRequestException('userId is required');
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
