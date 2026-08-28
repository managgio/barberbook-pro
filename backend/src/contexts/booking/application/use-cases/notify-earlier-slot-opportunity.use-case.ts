import { NotifyEarlierSlotOpportunityCommand } from '../commands/notify-earlier-slot-opportunity.command';
import { EarlierSlotNotificationPort } from '../../ports/outbound/earlier-slot-notification.port';
import { ClockPort } from '../../../../shared/application/clock.port';

export class NotifyEarlierSlotOpportunityUseCase {
  constructor(
    private readonly notificationPort: EarlierSlotNotificationPort,
    private readonly clockPort: ClockPort,
  ) {}

  execute(command: NotifyEarlierSlotOpportunityCommand): Promise<boolean> {
    if (command.releasedStartDateTime.getTime() <= this.clockPort.now().getTime()) {
      return Promise.resolve(false);
    }
    return this.notificationPort.notifyFirstEligibleRequest(command);
  }
}
