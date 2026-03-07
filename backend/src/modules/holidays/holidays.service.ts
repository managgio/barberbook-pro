import { Inject, Injectable } from '@nestjs/common';
import { AddBarberHolidayUseCase } from '../../contexts/booking/application/use-cases/add-barber-holiday.use-case';
import { AddGeneralHolidayUseCase } from '../../contexts/booking/application/use-cases/add-general-holiday.use-case';
import { GetBarberHolidaysUseCase } from '../../contexts/booking/application/use-cases/get-barber-holidays.use-case';
import { GetGeneralHolidaysUseCase } from '../../contexts/booking/application/use-cases/get-general-holidays.use-case';
import { RemoveBarberHolidayUseCase } from '../../contexts/booking/application/use-cases/remove-barber-holiday.use-case';
import { RemoveGeneralHolidayUseCase } from '../../contexts/booking/application/use-cases/remove-general-holiday.use-case';
import {
  HOLIDAY_MANAGEMENT_PORT,
  HolidayManagementPort,
} from '../../contexts/booking/ports/outbound/holiday-management.port';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../contexts/platform/ports/outbound/tenant-context.port';
import { HolidayRangeDto } from './dto/holiday-range.dto';

@Injectable()
export class HolidaysService {
  private readonly getGeneralHolidaysUseCase: GetGeneralHolidaysUseCase;
  private readonly addGeneralHolidayUseCase: AddGeneralHolidayUseCase;
  private readonly removeGeneralHolidayUseCase: RemoveGeneralHolidayUseCase;
  private readonly getBarberHolidaysUseCase: GetBarberHolidaysUseCase;
  private readonly addBarberHolidayUseCase: AddBarberHolidayUseCase;
  private readonly removeBarberHolidayUseCase: RemoveBarberHolidayUseCase;

  constructor(
    @Inject(HOLIDAY_MANAGEMENT_PORT)
    private readonly holidayManagementPort: HolidayManagementPort,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {
    this.getGeneralHolidaysUseCase = new GetGeneralHolidaysUseCase(this.holidayManagementPort);
    this.addGeneralHolidayUseCase = new AddGeneralHolidayUseCase(this.holidayManagementPort);
    this.removeGeneralHolidayUseCase = new RemoveGeneralHolidayUseCase(this.holidayManagementPort);
    this.getBarberHolidaysUseCase = new GetBarberHolidaysUseCase(this.holidayManagementPort);
    this.addBarberHolidayUseCase = new AddBarberHolidayUseCase(this.holidayManagementPort);
    this.removeBarberHolidayUseCase = new RemoveBarberHolidayUseCase(this.holidayManagementPort);
  }

  async getGeneralHolidays() {
    return this.getGeneralHolidaysUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
    });
  }

  async addGeneralHoliday(range: HolidayRangeDto) {
    return this.addGeneralHolidayUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      range: {
        start: range.start,
        end: range.end,
      },
    });
  }

  async removeGeneralHoliday(range: HolidayRangeDto) {
    return this.removeGeneralHolidayUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      range: {
        start: range.start,
        end: range.end,
      },
    });
  }

  async getBarberHolidays(barberId: string) {
    return this.getBarberHolidaysUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      barberId,
    });
  }

  async addBarberHoliday(barberId: string, range: HolidayRangeDto) {
    return this.addBarberHolidayUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      barberId,
      range: {
        start: range.start,
        end: range.end,
      },
    });
  }

  async removeBarberHoliday(barberId: string, range: HolidayRangeDto) {
    return this.removeBarberHolidayUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      barberId,
      range: {
        start: range.start,
        end: range.end,
      },
    });
  }
}
