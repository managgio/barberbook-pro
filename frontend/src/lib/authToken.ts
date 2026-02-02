import { getFirebaseAuth } from '@/lib/firebaseConfig';

export const getFirebaseIdToken = async (): Promise<string | null> => {
  try {
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) return null;
    return await user.getIdToken();
  } catch {
    return null;
  }
};

export const buildAuthHeaders = async (): Promise<Record<string, string>> => {
  const token = await getFirebaseIdToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
};
