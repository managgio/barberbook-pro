import { Injectable } from '@nestjs/common';
import { AiHolidayToolPort } from '../../../contexts/ai-orchestration/ports/outbound/ai-holiday-tool.port';
import { HolidaysService } from '../../holidays/holidays.service';

@Injectable()
export class ModuleAiHolidayToolAdapter implements AiHolidayToolPort {
  constructor(private readonly holidaysService: HolidaysService) {}

  getGeneralHolidays() {
    return this.holidaysService.getGeneralHolidays();
  }

  addGeneralHoliday(range: { start: string; end: string }) {
    return this.holidaysService.addGeneralHoliday(range);
  }

  addBarberHoliday(barberId: string, range: { start: string; end: string }) {
    return this.holidaysService.addBarberHoliday(barberId, range);
  }
}
