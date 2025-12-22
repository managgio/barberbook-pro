import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, GithubAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyAAXSNp-Hjmqyj4nGkDLTKJUXeCuIrNdYA',
  authDomain: 'barberbookpro-local.firebaseapp.com',
  projectId: 'barberbookpro-local',
  storageBucket: 'barberbookpro-local.firebasestorage.app',
  messagingSenderId: '905277075740',
  appId: '1:905277075740:web:d4b20b24e4c852b2e30ad9',
  measurementId: 'G-DBSTP3VLH0',
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();

export { app, auth, googleProvider, githubProvider };
