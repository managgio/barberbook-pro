import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AdminEndpoint } from '../../auth/admin.decorator';
import { NotificationsService } from './notifications.service';
import { TestSmsDto } from './dto/test-sms.dto';
import { TestWhatsappDto } from './dto/test-whatsapp.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('test-sms')
  @AdminEndpoint()
  sendTestSms(@Body() data: TestSmsDto) {
    return this.notificationsService.sendTestSms(data.phone, data.message || null);
  }

  @Post('test-whatsapp')
  @AdminEndpoint()
  sendTestWhatsapp(@Body() data: TestWhatsappDto) {
    return this.notificationsService.sendTestWhatsapp(data.phone, {
      message: data.message,
      name: data.name,
      brand: data.brand,
      date: data.date,
      time: data.time,
    });
  }

  @Get('deliveries')
  @AdminEndpoint()
  listDeliveries(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('kind') kind?: string,
    @Query('channel') channel?: string,
  ) {
    return this.notificationsService.listNotificationDeliveries({
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 25,
      status,
      kind,
      channel,
    });
  }

  @Post('deliveries/:id/retry')
  @AdminEndpoint()
  retryDelivery(@Param('id') id: string) {
    return this.notificationsService.retryNotificationDelivery(id);
  }

  @Get('email-deliveries')
  @AdminEndpoint()
  listLegacyEmailDeliveries(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('kind') kind?: string,
  ) {
    return this.notificationsService.listNotificationDeliveries({
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 25,
      status,
      kind,
      channel: 'email',
    });
  }

  @Post('email-deliveries/:id/retry')
  @AdminEndpoint()
  retryLegacyEmailDelivery(@Param('id') id: string) {
    return this.notificationsService.retryNotificationDelivery(id);
  }
}
