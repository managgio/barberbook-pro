import { UserReadPort } from '../../ports/outbound/user-read.port';
import { FindUserByFirebaseUidQuery } from '../queries/find-user-by-firebase-uid.query';

export class FindUserByFirebaseUidUseCase {
  constructor(private readonly userReadPort: UserReadPort) {}

  execute(query: FindUserByFirebaseUidQuery) {
    return this.userReadPort.findUserByFirebaseUid({
      brandId: query.context.brandId,
      localId: query.context.localId,
      firebaseUid: query.firebaseUid,
    });
  }
}
