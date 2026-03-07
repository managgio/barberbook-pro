import { RequestContext } from '../../../../shared/application/request-context';

export type CreateAdminRoleCommand = {
  context: RequestContext;
  name: string;
  description?: string;
  permissions: string[];
};

