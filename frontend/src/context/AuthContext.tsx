import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole } from '@/data/types';
import { createUser, getUserByEmail, getUserByFirebaseUid, updateUser } from '@/data/api';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile as updateFirebaseProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebaseConfig';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  signup: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SUPER_ADMIN_EMAIL = 'admin@barberia.com';
const defaultNotificationPrefs = { email: true, whatsapp: true };

const getDisplayName = (firebaseUser: FirebaseUser, providedName?: string) => {
  const email = firebaseUser.email || '';
  if (providedName) return providedName;
  if (firebaseUser.displayName) return firebaseUser.displayName;
  if (email) return email.split('@')[0];
  return 'Usuario';
};

const mapFirebaseUserToProfile = async (firebaseUser: FirebaseUser, extras?: Partial<User>): Promise<User> => {
  const email = firebaseUser.email || extras?.email;
  if (!email) {
    throw new Error('El usuario de Firebase no tiene email asociado');
  }

  const existingByUid = await getUserByFirebaseUid(firebaseUser.uid);
  const existing = existingByUid || (await getUserByEmail(email));

   const phone = extras?.phone || firebaseUser.phoneNumber || existing?.phone;
   const notificationPrefs =
    existing?.notificationPrefs ||
    (phone ? { ...defaultNotificationPrefs } : { email: true, whatsapp: false });

  const payload: Partial<User> = {
    firebaseUid: firebaseUser.uid,
    name: getDisplayName(firebaseUser, extras?.name),
    email,
    phone,
    avatar: firebaseUser.photoURL || existing?.avatar,
    role: existing?.role ?? (email === SUPER_ADMIN_EMAIL ? 'admin' : 'client'),
    adminRoleId: existing?.adminRoleId ?? null,
    isSuperAdmin: existing?.isSuperAdmin ?? (email === SUPER_ADMIN_EMAIL),
    notificationPrefs,
  };

  if (existing) {
    return updateUser(existing.id, payload);
  }

  return createUser({
    firebaseUid: firebaseUser.uid,
    name: payload.name || getDisplayName(firebaseUser),
    email,
    phone: payload.phone,
    role: (payload.role || 'client') as UserRole,
    notificationPrefs: payload.notificationPrefs || notificationPrefs,
    avatar: payload.avatar,
    adminRoleId: payload.adminRoleId ?? null,
    isSuperAdmin: payload.isSuperAdmin,
  });
};

const getFriendlyError = (error: any) => {
  const code = error?.code || '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Credenciales inválidas. Verifica tu email y contraseña.';
    case 'auth/popup-closed-by-user':
      return 'La ventana de inicio de sesión se cerró antes de completar el proceso.';
    case 'auth/email-already-in-use':
      return 'Ya existe una cuenta con ese email.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Inténtalo más tarde.';
    default:
      return 'No se pudo completar la autenticación. Inténtalo de nuevo.';
  }
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsLoading(true);
      if (!firebaseUser) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      try {
        const profile = await mapFirebaseUserToProfile(firebaseUser);
        setUser(profile);
      } catch (error) {
        console.error('Error al sincronizar el usuario de Firebase', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const profile = await mapFirebaseUserToProfile(credential.user);
      setUser(profile);
      return { success: true };
    } catch (error) {
      return { success: false, error: getFriendlyError(error) };
    }
  };

  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      const profile = await mapFirebaseUserToProfile(credential.user);
      setUser(profile);
      return { success: true };
    } catch (error) {
      return { success: false, error: getFriendlyError(error) };
    }
  };

  const signup = async (name: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      if (auth.currentUser) {
        await updateFirebaseProfile(auth.currentUser, { displayName: name });
      }
      const profile = await mapFirebaseUserToProfile(credential.user, { name });
      setUser(profile);
      return { success: true };
    } catch (error) {
      return { success: false, error: getFriendlyError(error) };
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  const updateProfile = async (data: Partial<User>) => {
    if (!user) return;
    const updated = await updateUser(user.id, data);
    setUser(updated);
    if (auth.currentUser && data.name) {
      await updateFirebaseProfile(auth.currentUser, { displayName: data.name });
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      loginWithGoogle,
      signup,
      logout,
      updateProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
