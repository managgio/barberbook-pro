import { UserReadPort } from '../../ports/outbound/user-read.port';
import { FindUsersPageQuery } from '../queries/find-users-page.query';

export class FindUsersPageUseCase {
  constructor(private readonly userReadPort: UserReadPort) {}

  execute(query: FindUsersPageQuery) {
    return this.userReadPort.findUsersPage({
      brandId: query.context.brandId,
      localId: query.context.localId,
      page: query.page,
      pageSize: query.pageSize,
      role: query.role,
      query: query.query,
    });
  }
}
