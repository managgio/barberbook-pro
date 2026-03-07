import { Inject, Injectable } from '@nestjs/common';
import { ResolveLoyaltyRewardDecisionUseCase } from '../../application/use-cases/resolve-loyalty-reward-decision.use-case';
import { TenantContextPort, TENANT_CONTEXT_PORT } from '../../../platform/ports/outbound/tenant-context.port';
import { CommerceLoyaltyPolicyPort } from '../../ports/outbound/loyalty-policy.port';

@Injectable()
export class PrismaCommerceLoyaltyPolicyAdapter implements CommerceLoyaltyPolicyPort {
  constructor(
    private readonly resolveLoyaltyRewardDecisionUseCase: ResolveLoyaltyRewardDecisionUseCase,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {}

  resolveRewardDecision(userId: string | null | undefined, serviceId: string) {
    const context = this.tenantContextPort.getRequestContext();
    return this.resolveLoyaltyRewardDecisionUseCase.execute({
      localId: context.localId,
      userId,
      serviceId,
      referenceDate: new Date(),
    });
  }
}
