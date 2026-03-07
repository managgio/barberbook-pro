import { Inject, Injectable } from '@nestjs/common';
import { GetBarberScheduleUseCase } from '../../contexts/booking/application/use-cases/get-barber-schedule.use-case';
import { GetShopScheduleUseCase } from '../../contexts/booking/application/use-cases/get-shop-schedule.use-case';
import { UpdateBarberScheduleUseCase } from '../../contexts/booking/application/use-cases/update-barber-schedule.use-case';
import { UpdateShopScheduleUseCase } from '../../contexts/booking/application/use-cases/update-shop-schedule.use-case';
import {
  SCHEDULE_MANAGEMENT_PORT,
  ScheduleManagementPort,
} from '../../contexts/booking/ports/outbound/schedule-management.port';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../contexts/platform/ports/outbound/tenant-context.port';
import { BookingSchedulePolicy } from '../../contexts/booking/domain/value-objects/schedule';
import { ShopSchedule } from './schedule.types';

@Injectable()
export class SchedulesService {
  private readonly getShopScheduleUseCase: GetShopScheduleUseCase;
  private readonly updateShopScheduleUseCase: UpdateShopScheduleUseCase;
  private readonly getBarberScheduleUseCase: GetBarberScheduleUseCase;
  private readonly updateBarberScheduleUseCase: UpdateBarberScheduleUseCase;

  constructor(
    @Inject(SCHEDULE_MANAGEMENT_PORT)
    private readonly scheduleManagementPort: ScheduleManagementPort,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {
    this.getShopScheduleUseCase = new GetShopScheduleUseCase(this.scheduleManagementPort);
    this.updateShopScheduleUseCase = new UpdateShopScheduleUseCase(this.scheduleManagementPort);
    this.getBarberScheduleUseCase = new GetBarberScheduleUseCase(this.scheduleManagementPort);
    this.updateBarberScheduleUseCase = new UpdateBarberScheduleUseCase(this.scheduleManagementPort);
  }

  async getShopSchedule(): Promise<ShopSchedule> {
    return this.getShopScheduleUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
    }) as Promise<ShopSchedule>;
  }

  async updateShopSchedule(schedule: ShopSchedule): Promise<ShopSchedule> {
    return this.updateShopScheduleUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      schedule: schedule as BookingSchedulePolicy,
    }) as Promise<ShopSchedule>;
  }

  async getBarberSchedule(barberId: string): Promise<ShopSchedule> {
    return this.getBarberScheduleUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      barberId,
    }) as Promise<ShopSchedule>;
  }

  async updateBarberSchedule(barberId: string, schedule: ShopSchedule): Promise<ShopSchedule> {
    return this.updateBarberScheduleUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      barberId,
      schedule: schedule as BookingSchedulePolicy,
    });
  }
}
