import { Body, Controller, Post } from '@nestjs/common';
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
}
