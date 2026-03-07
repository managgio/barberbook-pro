import { RequestContext } from '../../../../shared/application/request-context';
import { IdentityUserRole } from '../../domain/entities/user-access.entity';

export type FindUsersPageQuery = {
  context: RequestContext;
  page: number;
  pageSize: number;
  role?: IdentityUserRole;
  query?: string;
};

