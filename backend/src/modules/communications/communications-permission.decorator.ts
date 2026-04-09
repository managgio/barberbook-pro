import { SetMetadata } from '@nestjs/common';
import { CommunicationPermissionKey } from './communications.constants';

export const COMMUNICATION_PERMISSION_KEY = 'communication_permission_key';

export const RequireCommunicationPermission = (permission: CommunicationPermissionKey) =>
  SetMetadata(COMMUNICATION_PERMISSION_KEY, permission);
