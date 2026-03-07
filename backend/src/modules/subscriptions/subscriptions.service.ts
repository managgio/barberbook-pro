import { Inject, Injectable } from '@nestjs/common';
import {
  COMMERCE_SUBSCRIPTION_MANAGEMENT_PORT,
  CommerceSubscriptionManagementPort,
} from '../../contexts/commerce/ports/outbound/subscription-management.port';
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
  ) {}

  listPlansAdmin(includeArchived = false) {
    return this.subscriptionManagementPort.listPlansAdmin(includeArchived);
  }

  listActivePlans() {
    return this.subscriptionManagementPort.listActivePlans();
  }

  createPlan(data: CreateSubscriptionPlanDto) {
    return this.subscriptionManagementPort.createPlan(data);
  }

  updatePlan(id: string, data: UpdateSubscriptionPlanDto) {
    return this.subscriptionManagementPort.updatePlan(id, data);
  }

  archivePlan(id: string) {
    return this.subscriptionManagementPort.archivePlan(id);
  }

  listUserSubscriptions(userId: string) {
    return this.subscriptionManagementPort.listUserSubscriptions(userId);
  }

  listUserSubscriptionsPage(userId: string, params: { page: number; pageSize: number }) {
    return this.subscriptionManagementPort.listUserSubscriptionsPage(userId, params);
  }

  getUserActiveSubscription(userId: string, referenceDateInput?: string) {
    return this.subscriptionManagementPort.getUserActiveSubscription(userId, referenceDateInput);
  }

  assignUserSubscription(userId: string, data: AssignUserSubscriptionDto) {
    return this.subscriptionManagementPort.assignUserSubscription(userId, data);
  }

  subscribeCurrentUser(userId: string, data: SubscribePlanDto, baseUrl: string) {
    return this.subscriptionManagementPort.subscribeCurrentUser(userId, data, baseUrl);
  }

  markSubscriptionPaid(userId: string, subscriptionId: string, data: MarkSubscriptionPaidDto) {
    return this.subscriptionManagementPort.markSubscriptionPaid(userId, subscriptionId, data);
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
