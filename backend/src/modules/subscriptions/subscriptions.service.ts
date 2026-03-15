import { Inject, Injectable } from '@nestjs/common';
import {
  COMMERCE_SUBSCRIPTION_MANAGEMENT_PORT,
  CommerceSubscriptionManagementPort,
} from '../../contexts/commerce/ports/outbound/subscription-management.port';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../contexts/platform/ports/outbound/tenant-context.port';
import { LocalizationService } from '../localization/localization.service';
import { AssignUserSubscriptionDto } from './dto/assign-user-subscription.dto';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { MarkSubscriptionPaidDto } from './dto/mark-subscription-paid.dto';
import { SubscribePlanDto } from './dto/subscribe-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';

@Injectable()
export class SubscriptionsService {
  constructor(
    @Inject(COMMERCE_SUBSCRIPTION_MANAGEMENT_PORT)
    private readonly subscriptionManagementPort: CommerceSubscriptionManagementPort,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
    private readonly localizationService: LocalizationService,
  ) {}

  private async localizePlans<T extends { id: string; name: string; description?: string | null }>(
    items: T[],
  ): Promise<T[]> {
    const context = this.tenantContextPort.getRequestContext();
    const result = await this.localizationService.localizeCollection({
      context,
      entityType: 'subscription_plan',
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

  private async localizeSubscriptionsWithPlan<
    T extends { plan: { id: string; name: string; description?: string | null } | null },
  >(items: T[]): Promise<T[]> {
    const uniquePlans: Array<{ id: string; name: string; description?: string | null }> = [];
    const byId = new Set<string>();

    for (const item of items) {
      if (!item.plan) continue;
      if (byId.has(item.plan.id)) continue;
      byId.add(item.plan.id);
      uniquePlans.push(item.plan);
    }

    if (uniquePlans.length === 0) return items;
    await this.localizePlans(uniquePlans);
    return items;
  }

  async listPlansAdmin(includeArchived = false) {
    const plans = await this.subscriptionManagementPort.listPlansAdmin(includeArchived);
    return this.localizePlans(plans);
  }

  async listActivePlans() {
    const plans = await this.subscriptionManagementPort.listActivePlans();
    return this.localizePlans(plans);
  }

  async createPlan(data: CreateSubscriptionPlanDto) {
    const context = this.tenantContextPort.getRequestContext();
    const created = await this.subscriptionManagementPort.createPlan(data);
    await this.localizationService.syncEntitySourceFields({
      context,
      entityType: 'subscription_plan',
      entityId: created.id,
      fields: {
        name: created.name,
        description: created.description,
      },
    });
    return created;
  }

  async updatePlan(id: string, data: UpdateSubscriptionPlanDto) {
    const context = this.tenantContextPort.getRequestContext();
    const updated = await this.subscriptionManagementPort.updatePlan(id, data);
    await this.localizationService.syncEntitySourceFields({
      context,
      entityType: 'subscription_plan',
      entityId: updated.id,
      fields: {
        name: updated.name,
        description: updated.description,
      },
    });
    return updated;
  }

  archivePlan(id: string) {
    return this.subscriptionManagementPort.archivePlan(id);
  }

  async listUserSubscriptions(userId: string) {
    const subscriptions = await this.subscriptionManagementPort.listUserSubscriptions(userId);
    return this.localizeSubscriptionsWithPlan(subscriptions);
  }

  async listUserSubscriptionsPage(userId: string, params: { page: number; pageSize: number }) {
    const page = await this.subscriptionManagementPort.listUserSubscriptionsPage(userId, params);
    await this.localizeSubscriptionsWithPlan(page.items);
    return page;
  }

  async getUserActiveSubscription(userId: string, referenceDateInput?: string) {
    const active = await this.subscriptionManagementPort.getUserActiveSubscription(userId, referenceDateInput);
    if (!active) return null;
    await this.localizeSubscriptionsWithPlan([active]);
    return active;
  }

  async assignUserSubscription(userId: string, data: AssignUserSubscriptionDto) {
    const assigned = await this.subscriptionManagementPort.assignUserSubscription(userId, data);
    await this.localizeSubscriptionsWithPlan([assigned]);
    return assigned;
  }

  async subscribeCurrentUser(userId: string, data: SubscribePlanDto, baseUrl: string) {
    const result = await this.subscriptionManagementPort.subscribeCurrentUser(userId, data, baseUrl);
    await this.localizeSubscriptionsWithPlan([result.subscription]);
    return result;
  }

  async markSubscriptionPaid(userId: string, subscriptionId: string, data: MarkSubscriptionPaidDto) {
    const updated = await this.subscriptionManagementPort.markSubscriptionPaid(userId, subscriptionId, data);
    await this.localizeSubscriptionsWithPlan([updated]);
    return updated;
  }

  settlePendingInPersonPaymentFromAppointment(params: {
    subscriptionId: string | null | undefined;
    paymentMethod: string | null | undefined;
    completedAt?: Date;
  }) {
    return this.subscriptionManagementPort.settlePendingInPersonPaymentFromAppointment(params);
  }

  hasUsableActiveSubscription(userId: string | null | undefined, referenceDate = new Date()) {
    return this.subscriptionManagementPort.hasUsableActiveSubscription(userId, referenceDate);
  }

  resolveActiveSubscriptionForAppointment(userId: string | null | undefined, appointmentDate: Date) {
    return this.subscriptionManagementPort.resolveActiveSubscriptionForAppointment(userId, appointmentDate);
  }
}
