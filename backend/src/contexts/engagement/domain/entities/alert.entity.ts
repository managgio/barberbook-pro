export type AlertEntity = {
  id: string;
  localId: string;
  title: string;
  message: string;
  active: boolean;
  type: string;
  startDate: Date | null;
  endDate: Date | null;
};

