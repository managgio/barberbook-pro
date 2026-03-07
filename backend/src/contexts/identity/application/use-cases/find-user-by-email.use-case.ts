import { UserReadPort } from '../../ports/outbound/user-read.port';
import { FindUserByEmailQuery } from '../queries/find-user-by-email.query';

export class FindUserByEmailUseCase {
  constructor(private readonly userReadPort: UserReadPort) {}

  execute(query: FindUserByEmailQuery) {
    return this.userReadPort.findUserByEmail({
      brandId: query.context.brandId,
      localId: query.context.localId,
      email: query.email,
    });
  }
}
