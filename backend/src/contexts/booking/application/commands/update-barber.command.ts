import { RequestContext } from '../../../../shared/application/request-context';

export type UpdateBarberCommand = {
  context: RequestContext;
  barberId: string;
  name?: string;
  photo?: string | null;
  photoFileId?: string | null;
  specialty?: string;
  role?: string;
  bio?: string | null;
  startDate?: string;
  endDate?: string | null;
  isActive?: boolean;
  calendarColor?: string;
  userId?: string | null;
};
