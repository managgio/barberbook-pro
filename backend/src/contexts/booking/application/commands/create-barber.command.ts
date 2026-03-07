import { RequestContext } from '../../../../shared/application/request-context';

export type CreateBarberCommand = {
  context: RequestContext;
  name: string;
  photo?: string;
  photoFileId?: string | null;
  specialty: string;
  role?: string;
  bio?: string;
  startDate: string;
  endDate?: string | null;
  isActive?: boolean;
  calendarColor?: string;
  userId?: string;
};
