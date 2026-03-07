import { RequestContext } from '../../../../shared/application/request-context';

export type FindUserByFirebaseUidQuery = {
  context: RequestContext;
  firebaseUid: string;
};
