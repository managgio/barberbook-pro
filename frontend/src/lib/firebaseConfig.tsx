import type { FirebaseApp } from 'firebase/app';
import type {
  ActionCodeSettings,
  Auth,
  GithubAuthProvider,
  GoogleAuthProvider,
  User as FirebaseUser,
} from 'firebase/auth';
import { FirebaseWebConfig } from '@/data/types';

type FirebaseAppModule = typeof import('firebase/app');
type FirebaseAuthModule = typeof import('firebase/auth');

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let googleProvider: GoogleAuthProvider | null = null;
let githubProvider: GithubAuthProvider | null = null;

let appModulePromise: Promise<FirebaseAppModule> | null = null;
let authModulePromise: Promise<FirebaseAuthModule> | null = null;

const loadAppModule = () => {
  appModulePromise ||= import('firebase/app');
  return appModulePromise;
};

const loadAuthModule = () => {
  authModulePromise ||= import('firebase/auth');
  return authModulePromise;
};

const ensureProviders = (authModule: FirebaseAuthModule) => {
  if (!googleProvider) {
    googleProvider = new authModule.GoogleAuthProvider();
  }
  if (!githubProvider) {
    githubProvider = new authModule.GithubAuthProvider();
  }
};

const requireAuth = () => {
  if (!auth) {
    throw new Error('Firebase no está inicializado.');
  }
  return auth;
};

export const initFirebase = async (config: FirebaseWebConfig) => {
  if (app && auth) {
    return { app, auth };
  }
  const [appModule, authModule] = await Promise.all([loadAppModule(), loadAuthModule()]);
  app = appModule.initializeApp(config);
  auth = authModule.getAuth(app);
  ensureProviders(authModule);
  return { app, auth };
};

export const getFirebaseAuth = () => requireAuth();

export const onFirebaseAuthStateChanged = async (
  callback: (firebaseUser: FirebaseUser | null) => void,
) => {
  const authModule = await loadAuthModule();
  return authModule.onAuthStateChanged(requireAuth(), callback);
};

export const signInFirebaseWithEmailAndPassword = async (email: string, password: string) => {
  const authModule = await loadAuthModule();
  return authModule.signInWithEmailAndPassword(requireAuth(), email, password);
};

export const signInFirebaseWithGooglePopup = async () => {
  const authModule = await loadAuthModule();
  ensureProviders(authModule);
  return authModule.signInWithPopup(requireAuth(), googleProvider as GoogleAuthProvider);
};

export const createFirebaseUserWithEmailAndPassword = async (email: string, password: string) => {
  const authModule = await loadAuthModule();
  return authModule.createUserWithEmailAndPassword(requireAuth(), email, password);
};

export const sendFirebasePasswordResetEmail = async (
  email: string,
  actionCodeSettings?: ActionCodeSettings,
) => {
  const authModule = await loadAuthModule();
  return authModule.sendPasswordResetEmail(requireAuth(), email, actionCodeSettings);
};

export const verifyFirebaseBeforeUpdateEmail = async (
  user: FirebaseUser,
  newEmail: string,
  actionCodeSettings?: ActionCodeSettings,
) => {
  const authModule = await loadAuthModule();
  return authModule.verifyBeforeUpdateEmail(user, newEmail, actionCodeSettings);
};

export const reauthenticateFirebaseWithPassword = async (
  user: FirebaseUser,
  email: string,
  password: string,
) => {
  const authModule = await loadAuthModule();
  const credential = authModule.EmailAuthProvider.credential(email, password);
  return authModule.reauthenticateWithCredential(user, credential);
};

export const reauthenticateFirebaseWithGooglePopup = async (user: FirebaseUser) => {
  const authModule = await loadAuthModule();
  ensureProviders(authModule);
  return authModule.reauthenticateWithPopup(user, googleProvider as GoogleAuthProvider);
};

export const signOutFirebase = async () => {
  const authModule = await loadAuthModule();
  return authModule.signOut(requireAuth());
};

export const updateFirebaseUserProfile = async (
  user: FirebaseUser,
  profile: { displayName?: string | null; photoURL?: string | null },
) => {
  const authModule = await loadAuthModule();
  return authModule.updateProfile(user, profile);
};

export type { FirebaseUser };
