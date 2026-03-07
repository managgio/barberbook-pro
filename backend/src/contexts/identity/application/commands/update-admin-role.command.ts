import { RequestContext } from '../../../../shared/application/request-context';

export type UpdateAdminRoleCommand = {
  context: RequestContext;
  roleId: string;
  name?: string;
  description?: string;
  permissions?: string[];
};

