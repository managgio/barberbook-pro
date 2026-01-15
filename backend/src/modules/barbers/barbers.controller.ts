import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { BarbersService } from './barbers.service';
import { CreateBarberDto } from './dto/create-barber.dto';
import { UpdateBarberDto } from './dto/update-barber.dto';
import { AdminEndpoint } from '../../auth/admin.decorator';

@Controller('barbers')
export class BarbersController {
  constructor(private readonly barbersService: BarbersService) {}

  @Get()
  findAll() {
    return this.barbersService.findAll();
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

  @Delete(':id')
  @AdminEndpoint()
  remove(@Param('id') id: string) {
    return this.barbersService.remove(id);
  }
}
