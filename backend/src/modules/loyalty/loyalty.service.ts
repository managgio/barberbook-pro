import { Inject, Injectable } from '@nestjs/common';
import {
  COMMERCE_LOYALTY_MANAGEMENT_PORT,
  CommerceLoyaltyManagementPort,
} from '../../contexts/commerce/ports/outbound/loyalty-management.port';
import { CreateLoyaltyProgramDto } from './dto/create-loyalty-program.dto';
import { UpdateLoyaltyProgramDto } from './dto/update-loyalty-program.dto';

@Injectable()
export class LoyaltyService {
  constructor(
    @Inject(COMMERCE_LOYALTY_MANAGEMENT_PORT)
    private readonly loyaltyManagementPort: CommerceLoyaltyManagementPort,
  ) {}

  findAllAdmin() {
    return this.loyaltyManagementPort.findAllAdmin();
  }

  findActive() {
    return this.loyaltyManagementPort.findActive();
  }

  create(data: CreateLoyaltyProgramDto) {
    return this.loyaltyManagementPort.create(data);
  }

  update(id: string, data: UpdateLoyaltyProgramDto) {
    return this.loyaltyManagementPort.update(id, data);
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
