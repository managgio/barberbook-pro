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
import { GetExtraordinaryOpeningConflictsUseCase } from '../../contexts/booking/application/use-cases/get-extraordinary-opening-conflicts.use-case';
import { UpdateExtraordinaryOpeningsUseCase } from '../../contexts/booking/application/use-cases/update-extraordinary-openings.use-case';
import {
  EXTRAORDINARY_OPENING_MANAGEMENT_PORT,
  ExtraordinaryOpeningManagementPort,
} from '../../contexts/booking/ports/outbound/extraordinary-opening-management.port';

@Injectable()
export class SchedulesService {
  private readonly getShopScheduleUseCase: GetShopScheduleUseCase;
  private readonly updateShopScheduleUseCase: UpdateShopScheduleUseCase;
  private readonly getBarberScheduleUseCase: GetBarberScheduleUseCase;
  private readonly updateBarberScheduleUseCase: UpdateBarberScheduleUseCase;
  private readonly getExtraordinaryOpeningConflictsUseCase: GetExtraordinaryOpeningConflictsUseCase;
  private readonly updateExtraordinaryOpeningsUseCase: UpdateExtraordinaryOpeningsUseCase;

  constructor(
    @Inject(SCHEDULE_MANAGEMENT_PORT)
    private readonly scheduleManagementPort: ScheduleManagementPort,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
    @Inject(EXTRAORDINARY_OPENING_MANAGEMENT_PORT)
    private readonly extraordinaryOpeningManagementPort: ExtraordinaryOpeningManagementPort,
  ) {
    this.getShopScheduleUseCase = new GetShopScheduleUseCase(this.scheduleManagementPort);
    this.updateShopScheduleUseCase = new UpdateShopScheduleUseCase(this.scheduleManagementPort);
    this.getBarberScheduleUseCase = new GetBarberScheduleUseCase(this.scheduleManagementPort);
    this.updateBarberScheduleUseCase = new UpdateBarberScheduleUseCase(this.scheduleManagementPort);
    this.getExtraordinaryOpeningConflictsUseCase = new GetExtraordinaryOpeningConflictsUseCase(
      this.extraordinaryOpeningManagementPort,
    );
    this.updateExtraordinaryOpeningsUseCase = new UpdateExtraordinaryOpeningsUseCase(
      this.extraordinaryOpeningManagementPort,
    );
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

  async updateExtraordinaryOpenings(
    extraordinaryOpenings: NonNullable<ShopSchedule['extraordinaryOpenings']>,
  ): Promise<ShopSchedule> {
    return this.updateExtraordinaryOpeningsUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      openings: extraordinaryOpenings,
    }) as Promise<ShopSchedule>;
  }

  getExtraordinaryOpeningConflicts(params: {
    date: string;
    allProfessionals: boolean;
    barberIds: string[];
  }) {
    return this.getExtraordinaryOpeningConflictsUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      dateOnly: params.date,
      allProfessionals: params.allProfessionals,
      barberIds: params.barberIds,
    });
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
