import { UserReadPort } from '../../ports/outbound/user-read.port';
import { FindUsersByIdsQuery } from '../queries/find-users-by-ids.query';

export class FindUsersByIdsUseCase {
  constructor(private readonly userReadPort: UserReadPort) {}

  execute(query: FindUsersByIdsQuery) {
    return this.userReadPort.findUsersByIds({
      brandId: query.context.brandId,
      localId: query.context.localId,
      ids: query.ids,
    });
  }
}
