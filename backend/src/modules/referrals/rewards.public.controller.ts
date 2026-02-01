import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { RewardsService } from './rewards.service';

@Controller('rewards')
export class RewardsPublicController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Get('wallet')
  async getWallet(@Query('userId') userId?: string) {
    if (!userId) throw new BadRequestException('userId is required');
    return this.rewardsService.getWalletSummary(userId);
  }
}
