import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { AdminEndpoint } from '../../auth/admin.decorator';
import { AuthService } from '../../auth/auth.service';
import { buildBaseUrl } from '../payments/payments.utils';
import { AssignUserSubscriptionDto } from './dto/assign-user-subscription.dto';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { MarkSubscriptionPaidDto } from './dto/mark-subscription-paid.dto';
import { SubscribePlanDto } from './dto/subscribe-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly authService: AuthService,
  ) {}

  private parseBoolean(value?: string) {
    if (!value) return false;
    return value === '1' || value.toLowerCase() === 'true';
  }

  @AdminEndpoint()
  @Get('plans')
  listPlans(@Query('includeArchived') includeArchived?: string) {
    return this.subscriptionsService.listPlansAdmin(this.parseBoolean(includeArchived));
  }

  @Get('plans/active')
  listActivePlans() {
    return this.subscriptionsService.listActivePlans();
  }

  @AdminEndpoint()
  @Post('plans')
  createPlan(@Body() data: CreateSubscriptionPlanDto) {
    return this.subscriptionsService.createPlan(data);
  }

  @AdminEndpoint()
  @Patch('plans/:id')
  updatePlan(@Param('id') id: string, @Body() data: UpdateSubscriptionPlanDto) {
    return this.subscriptionsService.updatePlan(id, data);
  }

  @AdminEndpoint()
  @Delete('plans/:id')
  archivePlan(@Param('id') id: string) {
    return this.subscriptionsService.archivePlan(id);
  }

  @AdminEndpoint()
  @Get('users/:userId')
  listUserSubscriptions(
    @Param('userId') userId: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '10',
  ) {
    const pageNumber = Math.max(1, parseInt(page, 10) || 1);
    const limit = Math.min(100, Math.max(5, parseInt(pageSize, 10) || 10));
    return this.subscriptionsService.listUserSubscriptionsPage(userId, {
      page: pageNumber,
      pageSize: limit,
    });
  }

  @AdminEndpoint()
  @Get('users/:userId/active')
  getUserActiveSubscription(
    @Param('userId') userId: string,
    @Query('referenceDate') referenceDate?: string,
  ) {
    return this.subscriptionsService.getUserActiveSubscription(userId, referenceDate);
  }

  @AdminEndpoint()
  @Post('users/:userId/assign')
  assignUserSubscription(
    @Param('userId') userId: string,
    @Body() data: AssignUserSubscriptionDto,
  ) {
    return this.subscriptionsService.assignUserSubscription(userId, data);
  }

  @AdminEndpoint()
  @Post('users/:userId/:subscriptionId/mark-paid')
  markUserSubscriptionPaid(
    @Param('userId') userId: string,
    @Param('subscriptionId') subscriptionId: string,
    @Body() data: MarkSubscriptionPaidDto,
  ) {
    return this.subscriptionsService.markSubscriptionPaid(userId, subscriptionId, data);
  }

  @Get('me')
  async getMySubscriptions(@Req() req: Request) {
    const user = await this.authService.requireUser(req);
    return this.subscriptionsService.listUserSubscriptions(user.id);
  }

  @Get('me/active')
  async getMyActiveSubscription(@Req() req: Request, @Query('referenceDate') referenceDate?: string) {
    const user = await this.authService.requireUser(req);
    return this.subscriptionsService.getUserActiveSubscription(user.id, referenceDate);
  }

  @Post('subscribe')
  async subscribe(@Req() req: Request, @Body() data: SubscribePlanDto) {
    const user = await this.authService.requireUser(req);
    const baseUrl = buildBaseUrl(req);
    return this.subscriptionsService.subscribeCurrentUser(user.id, data, baseUrl);
  }
}
