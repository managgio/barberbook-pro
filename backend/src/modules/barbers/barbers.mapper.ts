import { Barber } from '@prisma/client';

const sanitizeBarberPhoto = (photo?: string | null): string | null => {
  if (!photo) return null;
  if (photo.includes('images.unsplash.com') || photo.toLowerCase().includes('shadcn')) {
    return null;
  }
  return photo;
};

export const mapBarber = (barber: Barber) => ({
  id: barber.id,
  name: barber.name,
  photo: sanitizeBarberPhoto(barber.photo) || null,
  photoFileId: sanitizeBarberPhoto(barber.photo) ? barber.photoFileId || null : null,
  specialty: barber.specialty,
  role: barber.role,
  bio: barber.bio || null,
  startDate: barber.startDate.toISOString().split('T')[0],
  endDate: barber.endDate ? barber.endDate.toISOString().split('T')[0] : null,
  isActive: barber.isActive,
  userId: barber.userId || null,
});
