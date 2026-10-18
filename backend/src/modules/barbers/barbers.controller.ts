import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { BarbersService } from './barbers.service';
import { CreateBarberDto } from './dto/create-barber.dto';
import { UpdateBarberDto } from './dto/update-barber.dto';
import { UpdateBarberServiceAssignmentDto } from './dto/update-barber-service-assignment.dto';
import { AdminEndpoint } from '../../auth/admin.decorator';

@Controller('barbers')
export class BarbersController {
  constructor(private readonly barbersService: BarbersService) {}

  @Get()
  findAll(@Query('serviceId') serviceId?: string, @Query('serviceIds') serviceIds?: string) {
    const normalizedServiceIds = Array.from(new Set(
      serviceIds?.split(',').map((id) => id.trim()).filter(Boolean) || [],
    ));
    if (new Set([serviceId, ...normalizedServiceIds].filter(Boolean)).size > 6) {
      throw new BadRequestException('Puedes combinar un máximo de 6 servicios.');
    }
    return this.barbersService.findAll(serviceId, { serviceIds: normalizedServiceIds });
  }

  @Get('admin')
  @AdminEndpoint()
  findAllForAdmin(@Query('serviceId') serviceId?: string) {
    return this.barbersService.findAll(serviceId, { includeInactive: true });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.barbersService.findOne(id);
  }

  @Post()
  @AdminEndpoint()
  create(@Body() data: CreateBarberDto) {
    return this.barbersService.create(data);
  }

  @Patch(':id')
  @AdminEndpoint()
  update(@Param('id') id: string, @Body() data: UpdateBarberDto) {
    return this.barbersService.update(id, data);
  }

  @Patch(':id/service-assignment')
  @AdminEndpoint()
  updateServiceAssignment(@Param('id') id: string, @Body() data: UpdateBarberServiceAssignmentDto) {
    return this.barbersService.updateServiceAssignment(id, data);
  }

  @Delete(':id')
  @AdminEndpoint()
  remove(@Param('id') id: string) {
    return this.barbersService.remove(id);
  }
}
