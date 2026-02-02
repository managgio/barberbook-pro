import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
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
import { getFirebaseAuth, googleProvider } from '@/lib/firebaseConfig';
import { useTenant } from './TenantContext';

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

const defaultNotificationPrefs = { email: true, whatsapp: true, sms: true };

const getDisplayName = (firebaseUser: FirebaseUser, providedName?: string) => {
  const email = firebaseUser.email || '';
  if (providedName) return providedName;
  if (firebaseUser.displayName) return firebaseUser.displayName;
  if (email) return email.split('@')[0];
  return 'Usuario';
};

const mapFirebaseUserToProfile = async (firebaseUser: FirebaseUser, extras?: Partial<User>): Promise<User> => {
  const email = (firebaseUser.email || extras?.email || '').toLowerCase();
  if (!email) {
    throw new Error('El usuario de Firebase no tiene email asociado');
  }

  const existingByUid = await getUserByFirebaseUid(firebaseUser.uid);
  const existing = existingByUid || (await getUserByEmail(email));

  const phone = extras?.phone || firebaseUser.phoneNumber || existing?.phone;
  const notificationPrefs = {
    email: existing?.notificationPrefs?.email ?? true,
    whatsapp: existing?.notificationPrefs?.whatsapp ?? true,
    sms: existing?.notificationPrefs?.sms ?? true,
  };
  const prefersBarberSelection = existing?.prefersBarberSelection ?? true;

  const payload: Partial<User> = {
    firebaseUid: firebaseUser.uid,
    name: getDisplayName(firebaseUser, extras?.name),
    email,
    phone,
    avatar: firebaseUser.photoURL || existing?.avatar,
    role: existing?.role ?? 'client',
    adminRoleId: existing?.adminRoleId ?? null,
    isSuperAdmin: existing?.isSuperAdmin,
    isPlatformAdmin: existing?.isPlatformAdmin,
    notificationPrefs,
    prefersBarberSelection,
  };

  if (existing) {
    const updatePayload: Partial<User> = {
      firebaseUid: payload.firebaseUid,
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      avatar: payload.avatar,
      notificationPrefs: payload.notificationPrefs,
      prefersBarberSelection: payload.prefersBarberSelection,
    };
    return updateUser(existing.id, updatePayload);
  }

  return createUser({
    firebaseUid: firebaseUser.uid,
    name: payload.name || getDisplayName(firebaseUser),
    email,
    phone: payload.phone,
    role: (payload.role || 'client') as UserRole,
    notificationPrefs: payload.notificationPrefs || notificationPrefs,
    prefersBarberSelection,
    avatar: payload.avatar,
    adminRoleId: payload.adminRoleId ?? null,
    isSuperAdmin: payload.isSuperAdmin,
    isPlatformAdmin: payload.isPlatformAdmin,
  });
};

const getFriendlyError = (error: unknown) => {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? (error as { code?: string }).code || ''
    : '';
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
  const { isReady: tenantReady, currentLocationId } = useTenant();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const syncRef = useRef<{ key: string | null; promise: Promise<User | null> | null }>({
    key: null,
    promise: null,
  });
  const lastSyncKeyRef = useRef<string | null>(null);

  const syncFirebaseProfile = async (firebaseUser: FirebaseUser): Promise<User | null> => {
    const key = `${firebaseUser.uid}:${currentLocationId || 'none'}`;
    if (lastSyncKeyRef.current === key && user?.firebaseUid === firebaseUser.uid) {
      return user;
    }
    const inFlight = syncRef.current;
    if (inFlight.promise) {
      if (inFlight.key === key) {
        return inFlight.promise;
      }
      try {
        await inFlight.promise;
      } catch {
        // Ignore to allow the new sync attempt.
      }
    }

    const promise = (async () => {
      const profile = await mapFirebaseUserToProfile(firebaseUser);
      setUser(profile);
      lastSyncKeyRef.current = key;
      return profile;
    })();

    syncRef.current = { key, promise };
    try {
      return await promise;
    } finally {
      if (syncRef.current.key === key) {
        syncRef.current = { key: null, promise: null };
      }
    }
  };

  useEffect(() => {
    if (!tenantReady) {
      setIsLoading(true);
      return;
    }
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsLoading(true);
      if (!firebaseUser) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      try {
        await syncFirebaseProfile(firebaseUser);
      } catch (error) {
        console.error('Error al sincronizar el usuario de Firebase', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [tenantReady]);

  useEffect(() => {
    if (!tenantReady) return;
    const auth = getFirebaseAuth();
    if (!auth.currentUser) return;
    setIsLoading(true);
    syncFirebaseProfile(auth.currentUser)
      .catch((error) => {
        console.error('Error al refrescar el usuario por local', error);
      })
      .finally(() => setIsLoading(false));
  }, [tenantReady, currentLocationId]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const auth = getFirebaseAuth();
      await signInWithEmailAndPassword(auth, email, password);
      return { success: true };
    } catch (error) {
      return { success: false, error: getFriendlyError(error) };
    }
  };

  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const auth = getFirebaseAuth();
      await signInWithPopup(auth, googleProvider);
      return { success: true };
    } catch (error) {
      return { success: false, error: getFriendlyError(error) };
    }
  };

  const signup = async (name: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const auth = getFirebaseAuth();
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      if (auth.currentUser) {
        await updateFirebaseProfile(auth.currentUser, { displayName: name });
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: getFriendlyError(error) };
    }
  };

  const logout = async () => {
    const auth = getFirebaseAuth();
    await signOut(auth);
    setUser(null);
  };

  const updateProfile = async (data: Partial<User>) => {
    if (!user) return;

    const payload: any = {
      name: data.name,
      email: data.email,
      phone: data.phone,
    };

    if (data.notificationPrefs) {
      payload.notificationEmail = data.notificationPrefs.email;
      payload.notificationWhatsapp = data.notificationPrefs.whatsapp;
      payload.notificationSms = data.notificationPrefs.sms;
    }
    if (data.prefersBarberSelection !== undefined) {
      payload.prefersBarberSelection = data.prefersBarberSelection;
    }

    const updated = await updateUser(user.id, payload);
    setUser(updated);
    const auth = getFirebaseAuth();
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
