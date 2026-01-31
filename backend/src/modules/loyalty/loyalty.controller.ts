import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AdminEndpoint } from '../../auth/admin.decorator';
import { LoyaltyService } from './loyalty.service';
import { CreateLoyaltyProgramDto } from './dto/create-loyalty-program.dto';
import { UpdateLoyaltyProgramDto } from './dto/update-loyalty-program.dto';

@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @AdminEndpoint()
  @Get('programs')
  findAll() {
    return this.loyaltyService.findAllAdmin();
  }

  @Get('programs/active')
  findActive() {
    return this.loyaltyService.findActive();
  }

  @AdminEndpoint()
  @Post('programs')
  create(@Body() data: CreateLoyaltyProgramDto) {
    return this.loyaltyService.create(data);
  }

  @AdminEndpoint()
  @Patch('programs/:id')
  update(@Param('id') id: string, @Body() data: UpdateLoyaltyProgramDto) {
    return this.loyaltyService.update(id, data);
  }

  @AdminEndpoint()
  @Delete('programs/:id')
  remove(@Param('id') id: string) {
    return this.loyaltyService.remove(id);
  }

  @Get('summary')
  getSummary(@Query('userId') userId: string) {
    return this.loyaltyService.getSummary(userId);
  }

  @Get('preview')
  getPreview(@Query('userId') userId: string, @Query('serviceId') serviceId: string) {
    return this.loyaltyService.getPreview(userId, serviceId);
  }
}
