export type ClientNoteEntity = {
  id: string;
  localId: string;
  userId: string;
  authorId: string | null;
  content: string;
  createdAt: Date;
  updatedAt: Date;
};

