import { isNextLoyaltyVisitFree } from '../../domain/services/loyalty-progress-policy';
import { CommerceLoyaltyRewardDecision } from '../../ports/outbound/loyalty-policy.port';
import {
  CommerceLoyaltyPolicyReadPort,
  CommerceLoyaltyProgram,
} from '../../ports/outbound/loyalty-policy-read.port';
import { CommerceSubscriptionPolicyPort } from '../../ports/outbound/subscription-policy.port';

type ResolveLoyaltyRewardDecisionQuery = {
  localId: string;
  userId: string | null | undefined;
  serviceId: string;
  referenceDate: Date;
};

const scoreScope = (scope: CommerceLoyaltyProgram['scope']) => {
  if (scope === 'service') return 3;
  if (scope === 'category') return 2;
  return 1;
};

const sortProgramsByPriority = (a: CommerceLoyaltyProgram, b: CommerceLoyaltyProgram) => {
  const scopeDiff = scoreScope(b.scope) - scoreScope(a.scope);
  if (scopeDiff !== 0) return scopeDiff;
  const priorityDiff = (b.priority ?? 0) - (a.priority ?? 0);
  if (priorityDiff !== 0) return priorityDiff;
  return b.createdAt.getTime() - a.createdAt.getTime();
};

export class ResolveLoyaltyRewardDecisionUseCase {
  constructor(
    private readonly readPort: CommerceLoyaltyPolicyReadPort,
    private readonly subscriptionPolicyPort: CommerceSubscriptionPolicyPort,
  ) {}

  async execute(query: ResolveLoyaltyRewardDecisionQuery): Promise<CommerceLoyaltyRewardDecision> {
    if (!query.userId) return null;

    const enabled = await this.readPort.isLoyaltyEnabled({ localId: query.localId });
    if (!enabled) return null;

    const hasSubscription = await this.subscriptionPolicyPort.hasUsableActiveSubscription(
      query.userId,
      query.referenceDate,
    );
    if (hasSubscription) return null;

    const userRole = await this.readPort.getUserRole({ userId: query.userId });
    if (userRole !== 'client') return null;

    const categoryId = await this.readPort.getServiceCategory({
      localId: query.localId,
      serviceId: query.serviceId,
    });

    const programs = await this.readPort.listActiveProgramsForService({
      localId: query.localId,
      serviceId: query.serviceId,
      categoryId,
    });
    if (programs.length === 0) return null;

    const eligiblePrograms: CommerceLoyaltyProgram[] = [];
    for (const program of programs) {
      if (program.maxCyclesPerClient && program.maxCyclesPerClient > 0) {
        const completedRewards = await this.readPort.countCompletedRewards({
          localId: query.localId,
          userId: query.userId,
          programId: program.id,
        });
        if (completedRewards >= program.maxCyclesPerClient) continue;
      }
      eligiblePrograms.push(program);
    }
    if (eligiblePrograms.length === 0) return null;

    const program = [...eligiblePrograms].sort(sortProgramsByPriority)[0];
    const [completedVisits, activeVisits] = await Promise.all([
      this.readPort.countCompletedVisits({
        localId: query.localId,
        userId: query.userId,
        programId: program.id,
      }),
      this.readPort.countActiveVisits({
        localId: query.localId,
        userId: query.userId,
        programId: program.id,
      }),
    ]);

    return {
      programId: program.id,
      isFreeNext: isNextLoyaltyVisitFree({
        requiredVisits: program.requiredVisits,
        totalVisitsAccumulated: completedVisits,
        activeVisits,
      }),
    };
  }
}
