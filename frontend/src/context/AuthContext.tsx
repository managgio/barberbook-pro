import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { User, UserRole } from '@/data/types';
import {
  createFirebaseUserWithEmailAndPassword,
  getFirebaseAuth,
  initFirebase,
  onFirebaseAuthStateChanged,
  reauthenticateFirebaseWithGooglePopup,
  reauthenticateFirebaseWithPassword,
  sendFirebasePasswordResetEmail,
  signInFirebaseWithEmailAndPassword,
  signInFirebaseWithGooglePopup,
  signOutFirebase,
  updateFirebaseUserProfile,
  verifyFirebaseBeforeUpdateEmail,
  FirebaseUser,
} from '@/lib/firebaseConfig';
import { createUser, getUserByEmail, getUserByFirebaseUid, updateUser } from '@/data/api/users';
import { useTenant } from './TenantContext';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  signup: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  forgotPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  requestEmailChange: (
    newEmail: string,
    currentPassword?: string,
  ) => Promise<{ success: boolean; error?: string; requiresPassword?: boolean }>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const defaultNotificationPrefs = { email: true, whatsapp: true, sms: true };

const getFirebaseFallback = () => ({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
});

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
    email: existing?.notificationPrefs?.email ?? defaultNotificationPrefs.email,
    whatsapp: existing?.notificationPrefs?.whatsapp ?? defaultNotificationPrefs.whatsapp,
    sms: existing?.notificationPrefs?.sms ?? defaultNotificationPrefs.sms,
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
    prefersBarberSelection,
  };

  const notificationFields = {
    notificationEmail: notificationPrefs.email,
    notificationWhatsapp: notificationPrefs.whatsapp,
    notificationSms: notificationPrefs.sms,
  };

  if (existing) {
    const updatePayload = {
      firebaseUid: payload.firebaseUid,
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      avatar: payload.avatar,
      ...notificationFields,
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
    ...notificationFields,
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
    case 'auth/invalid-email':
      return 'Introduce un email válido.';
    case 'auth/requires-recent-login':
      return 'Por seguridad, vuelve a iniciar sesión y repite la acción.';
    case 'auth/invalid-continue-uri':
    case 'auth/missing-continue-uri':
    case 'auth/unauthorized-continue-uri':
      return 'El dominio de recuperación no está autorizado en Firebase Auth.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Inténtalo más tarde.';
    default:
      if (error instanceof Error && error.message === 'FIREBASE_CONFIG_MISSING') {
        return 'Falta la configuración de Firebase. Revisa las variables VITE_FIREBASE_*.';
      }
      return 'No se pudo completar la autenticación. Inténtalo de nuevo.';
  }
};

const getProviderIds = (firebaseUser: FirebaseUser | null) =>
  new Set((firebaseUser?.providerData || []).map((item) => item.providerId).filter(Boolean));

const getErrorCode = (error: unknown) =>
  (typeof error === 'object' && error !== null && 'code' in error
    ? (error as { code?: string }).code || ''
    : '');

const isContinueUrlError = (code: string) =>
  code === 'auth/invalid-continue-uri' ||
  code === 'auth/missing-continue-uri' ||
  code === 'auth/unauthorized-continue-uri';

const buildActionCodeSettings = (path: string) => {
  if (typeof window === 'undefined') return undefined;
  const host = window.location.hostname.toLowerCase();
  const isLocalLike =
    host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost');
  const baseOrigin = isLocalLike
    ? `http://localhost:${window.location.port || '8080'}`
    : window.location.origin;
  return {
    url: `${baseOrigin}${path}`,
    handleCodeInApp: false,
  };
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

  const syncFirebaseProfile = useCallback(async (firebaseUser: FirebaseUser): Promise<User | null> => {
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
  }, [currentLocationId, user]);

  const authenticateAndSync = useCallback(
    async (firebaseUser: FirebaseUser | null): Promise<{ success: boolean; error?: string }> => {
      if (!firebaseUser) {
        return { success: false, error: 'No se pudo completar el inicio de sesión.' };
      }
      try {
        await syncFirebaseProfile(firebaseUser);
        return { success: true };
      } catch (error) {
        console.error('Error sincronizando perfil tras autenticación', error);
        setUser(null);
        try {
          await signOutFirebase();
        } catch {
          // Ignore sign-out cleanup errors to keep original sync error context.
        }
        return { success: false, error: getFriendlyError(error) };
      }
    },
    [syncFirebaseProfile],
  );

  const ensureFirebaseReady = useCallback(async () => {
    const fallback = getFirebaseFallback();
    if (!fallback?.apiKey) {
      throw new Error('FIREBASE_CONFIG_MISSING');
    }
    await initFirebase(fallback);
    return getFirebaseAuth();
  }, []);

  useEffect(() => {
    if (!tenantReady) {
      setIsLoading(true);
      return;
    }
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    void (async () => {
      try {
        await ensureFirebaseReady();
        unsubscribe = await onFirebaseAuthStateChanged(async (firebaseUser) => {
          if (cancelled) return;
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
      } catch (error) {
        console.error('Error inicializando Firebase Auth', error);
        if (!cancelled) {
          setUser(null);
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [tenantReady, ensureFirebaseReady, syncFirebaseProfile]);

  useEffect(() => {
    if (!tenantReady) return;
    void (async () => {
      try {
        const auth = await ensureFirebaseReady();
        if (!auth.currentUser) return;
        setIsLoading(true);
        await syncFirebaseProfile(auth.currentUser);
      } catch (error) {
        console.error('Error al refrescar el usuario por local', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [tenantReady, currentLocationId, ensureFirebaseReady, syncFirebaseProfile]);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      await ensureFirebaseReady();
      const credentials = await signInFirebaseWithEmailAndPassword(email, password);
      return await authenticateAndSync(credentials.user);
    } catch (error) {
      return { success: false, error: getFriendlyError(error) };
    }
  }, [authenticateAndSync, ensureFirebaseReady]);

  const loginWithGoogle = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      await ensureFirebaseReady();
      const credentials = await signInFirebaseWithGooglePopup();
      return await authenticateAndSync(credentials.user);
    } catch (error) {
      return { success: false, error: getFriendlyError(error) };
    }
  }, [authenticateAndSync, ensureFirebaseReady]);

  const signup = useCallback(async (name: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const auth = await ensureFirebaseReady();
      const credentials = await createFirebaseUserWithEmailAndPassword(email, password);
      const targetUser = auth.currentUser ?? credentials.user;
      if (targetUser) {
        await updateFirebaseUserProfile(targetUser, { displayName: name });
      }
      return await authenticateAndSync(targetUser);
    } catch (error) {
      return { success: false, error: getFriendlyError(error) };
    }
  }, [authenticateAndSync, ensureFirebaseReady]);

  const forgotPassword = useCallback(
    async (email: string): Promise<{ success: boolean; error?: string }> => {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) {
        return { success: false, error: 'Introduce un email válido.' };
      }
      try {
        await ensureFirebaseReady();
        try {
          await sendFirebasePasswordResetEmail(
            normalizedEmail,
            buildActionCodeSettings('/auth?tab=login'),
          );
        } catch (error) {
          const code = getErrorCode(error);
          if (isContinueUrlError(code)) {
            // Fallback to Firebase default handler when local/custom domains are not authorized.
            await sendFirebasePasswordResetEmail(normalizedEmail);
          } else {
            throw error;
          }
        }
        return { success: true };
      } catch (error) {
        const code = getErrorCode(error);
        if (code === 'auth/user-not-found') {
          // Avoid user enumeration leaks.
          return { success: true };
        }
        return { success: false, error: getFriendlyError(error) };
      }
    },
    [ensureFirebaseReady],
  );

  const requestEmailChange = useCallback(
    async (
      newEmail: string,
      currentPassword?: string,
    ): Promise<{ success: boolean; error?: string; requiresPassword?: boolean }> => {
      if (!user) {
        return { success: false, error: 'Debes iniciar sesión para cambiar el correo.' };
      }

      const normalizedEmail = newEmail.trim().toLowerCase();
      if (!normalizedEmail) {
        return { success: false, error: 'Introduce un email válido.' };
      }

      try {
        const auth = await ensureFirebaseReady();
        const currentUser = auth.currentUser;
        if (!currentUser) {
          return { success: false, error: 'Tu sesión ha caducado. Vuelve a iniciar sesión.' };
        }
        if (user.firebaseUid && currentUser.uid !== user.firebaseUid) {
          return { success: false, error: 'La sesión actual no coincide con tu perfil.' };
        }

        const currentEmail = (currentUser.email || user.email || '').toLowerCase();
        if (normalizedEmail === currentEmail) {
          return { success: false, error: 'Ese correo ya es tu correo actual.' };
        }

        const providerIds = getProviderIds(currentUser);
        const hasPasswordProvider = providerIds.has('password');
        const hasGoogleProvider = providerIds.has('google.com');

        if (hasPasswordProvider && currentPassword?.trim()) {
          await reauthenticateFirebaseWithPassword(
            currentUser,
            currentUser.email || user.email,
            currentPassword.trim(),
          );
        }

        const runVerifyBeforeUpdateEmail = async () => {
          try {
            await verifyFirebaseBeforeUpdateEmail(
              currentUser,
              normalizedEmail,
              buildActionCodeSettings('/app/profile'),
            );
          } catch (error) {
            const code = getErrorCode(error);
            if (isContinueUrlError(code)) {
              await verifyFirebaseBeforeUpdateEmail(currentUser, normalizedEmail);
              return;
            }
            throw error;
          }
        };

        try {
          await runVerifyBeforeUpdateEmail();
          return { success: true };
        } catch (error) {
          const code = getErrorCode(error);

          if (code === 'auth/requires-recent-login') {
            if (hasPasswordProvider && !currentPassword?.trim()) {
              return {
                success: false,
                requiresPassword: true,
                error: 'Por seguridad, confirma tu contraseña actual para cambiar el correo.',
              };
            }

            if (hasGoogleProvider && !hasPasswordProvider) {
              try {
                await reauthenticateFirebaseWithGooglePopup(currentUser);
                await runVerifyBeforeUpdateEmail();
                return { success: true };
              } catch (reauthError) {
                return { success: false, error: getFriendlyError(reauthError) };
              }
            }
          }

          return { success: false, error: getFriendlyError(error) };
        }
      } catch (error) {
        return { success: false, error: getFriendlyError(error) };
      }
    },
    [ensureFirebaseReady, user],
  );

  const logout = useCallback(async () => {
    await ensureFirebaseReady();
    await signOutFirebase();
    setUser(null);
  }, [ensureFirebaseReady]);

  const updateProfile = useCallback(async (data: Partial<User>) => {
    if (!user) return;

    const payload: Partial<User> & {
      notificationEmail?: boolean;
      notificationWhatsapp?: boolean;
      notificationSms?: boolean;
    } = {
      name: data.name,
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
    const auth = await ensureFirebaseReady();
    if (auth.currentUser && data.name) {
      await updateFirebaseUserProfile(auth.currentUser, { displayName: data.name });
    }
  }, [ensureFirebaseReady, user]);

  const contextValue = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      loginWithGoogle,
      signup,
      forgotPassword,
      requestEmailChange,
      logout,
      updateProfile,
    }),
    [
      user,
      isLoading,
      login,
      loginWithGoogle,
      signup,
      forgotPassword,
      requestEmailChange,
      logout,
      updateProfile,
    ],
  );

  return (
    <AuthContext.Provider value={contextValue}>
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
