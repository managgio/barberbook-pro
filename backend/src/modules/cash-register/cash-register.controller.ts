import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AdminEndpoint } from '../../auth/admin.decorator';
import { CashRegisterService } from './cash-register.service';
import { CreateCashMovementDto } from './dto/create-cash-movement.dto';
import { UpdateCashMovementDto } from './dto/update-cash-movement.dto';

@Controller('cash-register')
@AdminEndpoint()
export class CashRegisterController {
  constructor(private readonly cashRegisterService: CashRegisterService) {}

  @Get('movements')
  list(@Query('date') date?: string) {
    if (!date) {
      throw new BadRequestException('date es requerido.');
    }
    return this.cashRegisterService.listMovements(date);
  }

  @Post('movements')
  create(@Body() data: CreateCashMovementDto) {
    return this.cashRegisterService.createMovement(data);
  }

  @Patch('movements/:id')
  update(@Param('id') id: string, @Body() data: UpdateCashMovementDto) {
    return this.cashRegisterService.updateMovement(id, data);
  }

  @Delete('movements/:id')
  remove(@Param('id') id: string) {
    return this.cashRegisterService.removeMovement(id);
  }
}
