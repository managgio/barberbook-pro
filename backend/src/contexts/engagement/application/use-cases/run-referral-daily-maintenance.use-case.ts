import { EngagementReferralMaintenancePort } from '../../ports/outbound/referral-maintenance.port';

export class RunReferralDailyMaintenanceUseCase {
  constructor(private readonly referralMaintenancePort: EngagementReferralMaintenancePort) {}

  async execute() {
    const [referralAttributionsExpired, referralStaleHoldsProcessed] = await Promise.all([
      this.referralMaintenancePort.expireAttributions(),
      this.referralMaintenancePort.cleanupStaleHolds(),
    ]);
    return {
      referralAttributionsExpired,
      referralStaleHoldsProcessed,
    };
  }
}
