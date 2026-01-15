import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, GithubAuthProvider, Auth } from 'firebase/auth';
import { FirebaseWebConfig } from '@/data/types';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();

export const initFirebase = (config: FirebaseWebConfig) => {
  if (app) return { app, auth } as { app: FirebaseApp; auth: Auth };
  app = initializeApp(config);
  auth = getAuth(app);
  return { app, auth };
};

export const getFirebaseAuth = () => {
  if (!auth) {
    throw new Error('Firebase no está inicializado.');
  }
  return auth;
};

export { googleProvider, githubProvider };
