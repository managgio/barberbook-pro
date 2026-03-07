import { UserReadPort } from '../../ports/outbound/user-read.port';
import { FindUserByIdQuery } from '../queries/find-user-by-id.query';

export class FindUserByIdUseCase {
  constructor(private readonly userReadPort: UserReadPort) {}

  execute(query: FindUserByIdQuery) {
    return this.userReadPort.findUserById({
      brandId: query.context.brandId,
      localId: query.context.localId,
      userId: query.userId,
    });
  }
}
