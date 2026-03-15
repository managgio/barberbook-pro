import { Inject, Injectable } from '@nestjs/common';
import {
  COMMERCE_LOYALTY_MANAGEMENT_PORT,
  CommerceLoyaltyManagementPort,
} from '../../contexts/commerce/ports/outbound/loyalty-management.port';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../contexts/platform/ports/outbound/tenant-context.port';
import { LocalizationService } from '../localization/localization.service';
import { CreateLoyaltyProgramDto } from './dto/create-loyalty-program.dto';
import { UpdateLoyaltyProgramDto } from './dto/update-loyalty-program.dto';

@Injectable()
export class LoyaltyService {
  constructor(
    @Inject(COMMERCE_LOYALTY_MANAGEMENT_PORT)
    private readonly loyaltyManagementPort: CommerceLoyaltyManagementPort,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
    private readonly localizationService: LocalizationService,
  ) {}

  private async localizePrograms<T extends { id: string; name: string; description?: string | null }>(
    items: T[],
  ): Promise<T[]> {
    const context = this.tenantContextPort.getRequestContext();
    const result = await this.localizationService.localizeCollection({
      context,
      entityType: 'loyalty_program',
      items,
      descriptors: [
        {
          fieldKey: 'name',
          getValue: (item) => item.name,
          setValue: (item, value) => {
            item.name = value;
          },
        },
        {
          fieldKey: 'description',
          getValue: (item) => item.description,
          setValue: (item, value) => {
            item.description = value;
          },
        },
      ],
    });
    return result.items;
  }

  async findAllAdmin() {
    const programs = await this.loyaltyManagementPort.findAllAdmin();
    return this.localizePrograms(programs);
  }

  async findActive() {
    const programs = await this.loyaltyManagementPort.findActive();
    return this.localizePrograms(programs);
  }

  async create(data: CreateLoyaltyProgramDto) {
    const context = this.tenantContextPort.getRequestContext();
    const created = await this.loyaltyManagementPort.create(data);
    await this.localizationService.syncEntitySourceFields({
      context,
      entityType: 'loyalty_program',
      entityId: created.id,
      fields: {
        name: created.name,
        description: created.description,
      },
    });
    return created;
  }

  async update(id: string, data: UpdateLoyaltyProgramDto) {
    const context = this.tenantContextPort.getRequestContext();
    const updated = await this.loyaltyManagementPort.update(id, data);
    await this.localizationService.syncEntitySourceFields({
      context,
      entityType: 'loyalty_program',
      entityId: updated.id,
      fields: {
        name: updated.name,
        description: updated.description,
      },
    });
    return updated;
  }

  remove(id: string) {
    return this.loyaltyManagementPort.remove(id);
  }

  getSummary(userId: string) {
    return this.loyaltyManagementPort.getSummary(userId);
  }

  getPreview(userId: string, serviceId: string) {
    return this.loyaltyManagementPort.getPreview(userId, serviceId);
  }

  resolveRewardDecision(userId: string | null | undefined, serviceId: string) {
    return this.loyaltyManagementPort.resolveRewardDecision(userId, serviceId);
  }
}
