import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { AdminEndpoint } from '../../auth/admin.decorator';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  findAll() {
    return this.alertsService.findAll();
  }

  @Get('active')
  findActive() {
    return this.alertsService.findActive();
  }

  @Post()
  @AdminEndpoint()
  create(@Body() data: CreateAlertDto) {
    return this.alertsService.create(data);
  }

  @Patch(':id')
  @AdminEndpoint()
  update(@Param('id') id: string, @Body() data: UpdateAlertDto) {
    return this.alertsService.update(id, data);
  }

  @Delete(':id')
  @AdminEndpoint()
  remove(@Param('id') id: string) {
    return this.alertsService.remove(id);
  }
}
