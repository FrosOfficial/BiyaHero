import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, Database } from 'firebase/database';
import { firebaseConfig, isConfigured } from './firebaseConfig';

let db: Database | null = null;

if (isConfigured) {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  db = getDatabase(app);
}

export { db, isConfigured };
