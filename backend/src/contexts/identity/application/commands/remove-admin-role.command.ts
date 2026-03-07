import { RequestContext } from '../../../../shared/application/request-context';

export type RemoveAdminRoleCommand = {
  context: RequestContext;
  roleId: string;
};

