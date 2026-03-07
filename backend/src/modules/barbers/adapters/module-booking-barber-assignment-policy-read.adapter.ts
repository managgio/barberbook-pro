import { Injectable } from '@nestjs/common';
import { BarberAssignmentPolicyReadPort } from '../../../contexts/booking/ports/outbound/barber-assignment-policy-read.port';
import { SettingsService } from '../../settings/settings.service';

@Injectable()
export class ModuleBookingBarberAssignmentPolicyReadAdapter
  implements BarberAssignmentPolicyReadPort
{
  constructor(private readonly settingsService: SettingsService) {}

  async isBarberServiceAssignmentEnabled(): Promise<boolean> {
    const settings = await this.settingsService.getSettings();
    return settings.services.barberServiceAssignmentEnabled;
  }
}
