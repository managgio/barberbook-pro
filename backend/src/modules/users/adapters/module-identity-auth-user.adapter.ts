import { Injectable } from '@nestjs/common';
import { IdentityAuthUserPort } from '../../../contexts/identity/ports/outbound/identity-auth-user.port';
import { FirebaseAdminService } from '../../firebase/firebase-admin.service';

@Injectable()
export class ModuleIdentityAuthUserAdapter implements IdentityAuthUserPort {
  constructor(private readonly firebaseAdminService: FirebaseAdminService) {}

  async deleteUser(firebaseUid: string): Promise<void> {
    await this.firebaseAdminService.deleteUser(firebaseUid);
  }
}
