export type BarberDirectoryEntry = {
  id: string;
  localId: string;
  name: string;
  photo: string | null;
  photoFileId: string | null;
  specialty: string;
  role: string;
  bio: string | null;
  startDate: Date;
  endDate: Date | null;
  isActive: boolean;
  calendarColor: string | null;
  userId: string | null;
  assignedServiceIds: string[];
  assignedCategoryIds: string[];
};
