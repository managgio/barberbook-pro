import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { SchedulesModule } from '../schedules/schedules.module';
import { HolidaysModule } from '../holidays/holidays.module';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { AiAssistantController } from './ai-assistant.controller';
import { AiAssistantService } from './ai-assistant.service';
import { AiMemoryService } from './ai-memory.service';
import { AiToolsRegistry } from './ai-tools.registry';
import { AiAssistantGuard } from './ai-assistant.guard';

@Module({
  imports: [PrismaModule, AppointmentsModule, SchedulesModule, HolidaysModule, TenancyModule],
  controllers: [AiAssistantController],
  providers: [AiAssistantService, AiMemoryService, AiToolsRegistry, AiAssistantGuard],
})
export class AiAssistantModule {}
