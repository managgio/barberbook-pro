import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../../auth/auth.service';
import { ReviewRequestService } from './review-request.service';
import { ReviewRateDto } from './dto/review-rate.dto';
import { ReviewFeedbackDto } from './dto/review-feedback.dto';

@Controller('reviews')
export class ReviewsClientController {
  constructor(private readonly reviewService: ReviewRequestService, private readonly auth: AuthService) {}

  private async actor(req: Request) { return { userId: (await this.auth.requireUser(req)).id }; }

  @Get('pending')
  async getPending(@Req() req: Request) {
    return this.reviewService.getPendingReview(await this.actor(req));
  }

  @Post(':id/shown')
  async markShown(@Param('id') id: string, @Req() req: Request) {
    return this.reviewService.markShown(id, await this.actor(req));
  }

  @Post(':id/rate')
  async rate(@Param('id') id: string, @Body() data: ReviewRateDto, @Req() req: Request) {
    return this.reviewService.rate(id, data.rating, await this.actor(req));
  }

  @Post(':id/feedback')
  async feedback(@Param('id') id: string, @Body() data: ReviewFeedbackDto, @Req() req: Request) {
    return this.reviewService.submitFeedback(id, data.text, await this.actor(req));
  }

  @Post(':id/click')
  async click(@Param('id') id: string, @Req() req: Request) {
    return this.reviewService.markClicked(id, await this.actor(req));
  }

  @Post(':id/snooze')
  async snooze(@Param('id') id: string, @Req() req: Request) {
    return this.reviewService.snooze(id, await this.actor(req));
  }
}
