// ============================================================================
//  ÉTAPE 2 DU GUIDE : collez ici la configuration de VOTRE projet Firebase.
//  (Console Firebase > Paramètres du projet > Vos applications > </> Web)
// ============================================================================
import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const firebaseConfig = {
  apiKey: 'COLLEZ_ICI',
  authDomain: 'COLLEZ_ICI.firebaseapp.com',
  projectId: 'COLLEZ_ICI',
  storageBucket: 'COLLEZ_ICI.appspot.com',
  messagingSenderId: 'COLLEZ_ICI',
  appId: 'COLLEZ_ICI',
};

export const isFirebaseConfigured = !firebaseConfig.apiKey.startsWith('COLLEZ');

const alreadyInit = getApps().length > 0;
export const app = alreadyInit ? getApp() : initializeApp(firebaseConfig);

// La session reste ouverte entre deux lancements (stockée sur le téléphone).
export const auth = alreadyInit
  ? getAuth(app)
  : initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });

// Long polling auto : connexion plus fiable en 4G / Wi-Fi d'hôtel.
export const db = alreadyInit
  ? getFirestore(app)
  : initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
