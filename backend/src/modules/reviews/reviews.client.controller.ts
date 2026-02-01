import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ReviewRequestService } from './review-request.service';
import { ReviewRateDto } from './dto/review-rate.dto';
import { ReviewFeedbackDto } from './dto/review-feedback.dto';
import { ReviewActorDto } from './dto/review-actor.dto';

@Controller('reviews')
export class ReviewsClientController {
  constructor(private readonly reviewService: ReviewRequestService) {}

  @Get('pending')
  getPending(
    @Query('userId') userId?: string,
    @Query('guestEmail') guestEmail?: string,
    @Query('guestPhone') guestPhone?: string,
  ) {
    if (!userId && !guestEmail && !guestPhone) {
      throw new BadRequestException('userId o contacto requerido.');
    }
    return this.reviewService.getPendingReview({ userId, guestEmail, guestPhone });
  }

  @Post(':id/shown')
  markShown(@Param('id') id: string, @Body() data: ReviewActorDto) {
    return this.reviewService.markShown(id, data);
  }

  @Post(':id/rate')
  rate(@Param('id') id: string, @Body() data: ReviewRateDto) {
    return this.reviewService.rate(id, data.rating, data);
  }

  @Post(':id/feedback')
  feedback(@Param('id') id: string, @Body() data: ReviewFeedbackDto) {
    return this.reviewService.submitFeedback(id, data.text, data);
  }

  @Post(':id/click')
  click(@Param('id') id: string, @Body() data: ReviewActorDto) {
    return this.reviewService.markClicked(id, data);
  }

  @Post(':id/snooze')
  snooze(@Param('id') id: string, @Body() data: ReviewActorDto) {
    return this.reviewService.snooze(id, data);
  }
}
