import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { isTenantScopeGuardBypassed } from '../tenancy/tenant.context';

const TENANT_SCOPE_GUARDED_ACTIONS = new Set([
  'findMany',
  'findFirst',
  'findUnique',
  'findFirstOrThrow',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'deleteMany',
]);

const TENANT_LOCAL_SCOPED_MODELS = new Set([
  'AdminRole',
  'LocationStaff',
  'Barber',
  'Service',
  'Appointment',
  'Alert',
  'GeneralHoliday',
  'BarberHoliday',
  'ShopSchedule',
  'SiteSettings',
  'BarberSchedule',
  'ServiceCategory',
  'Offer',
  'LoyaltyProgram',
  'ProductCategory',
  'Product',
  'ReferralProgramConfig',
  'ReferralCode',
  'ReferralAttribution',
  'ReviewProgramConfig',
  'ReviewRequest',
  'RewardWallet',
  'RewardTransaction',
  'Coupon',
  'ClientNote',
  'CashMovement',
  'CashMovementProductItem',
  'AiChatSession',
  'AiChatMessage',
  'AiBusinessFact',
]);

const hasScopeField = (value: unknown, scopeField: string, depth = 0): boolean => {
  if (depth > 8) return false;
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) {
    return value.some((item) => hasScopeField(item, scopeField, depth + 1));
  }
  const record = value as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(record, scopeField)) {
    return true;
  }
  return Object.values(record).some((item) => hasScopeField(item, scopeField, depth + 1));
};

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private scopeGuardInstalled = false;
  private readonly scopeGuardEnabled =
    (process.env.TENANT_SCOPE_RUNTIME_GUARD || 'true').toLowerCase() !== 'false';

  private installTenantScopeGuard() {
    if (!this.scopeGuardEnabled || this.scopeGuardInstalled) return;
    this.scopeGuardInstalled = true;
    this.$use(async (params, next) => {
      if (isTenantScopeGuardBypassed()) {
        return next(params);
      }
      const model = params.model;
      const action = params.action;
      if (!model || !action) {
        return next(params);
      }
      if (!TENANT_LOCAL_SCOPED_MODELS.has(model) || !TENANT_SCOPE_GUARDED_ACTIONS.has(action)) {
        return next(params);
      }
      if (hasScopeField(params.args, 'localId')) {
        return next(params);
      }
      throw new Error(`[TENANT_SCOPE_GUARD] Missing localId in prisma.${model}.${action}`);
    });
  }

  async onModuleInit() {
    this.installTenantScopeGuard();
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
