import { openDB, IDBPDatabase } from 'idb';

export interface SyncAction {
  id?: number;
  type: 'CREATE_AD' | 'SEND_MESSAGE' | 'REGISTER_USER';
  payload: any;
  timestamp: number;
}

const DB_NAME = 'miam-miam-db';
const DB_VERSION = 1;

export const initDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('ads')) {
        db.createObjectStore('ads', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('user')) {
        db.createObjectStore('user', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('messages')) {
        db.createObjectStore('messages', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('sync-queue')) {
        db.createObjectStore('sync-queue', { keyPath: 'id', autoIncrement: true });
      }
    },
  });
};

export const saveAds = async (ads: any[]) => {
  const db = await initDB();
  const tx = db.transaction('ads', 'readwrite');
  await tx.objectStore('ads').clear();
  for (const ad of ads) {
    await tx.objectStore('ads').put(ad);
  }
  await tx.done;
};

export const getAds = async () => {
  const db = await initDB();
  return db.getAll('ads');
};

export const saveUser = async (user: any) => {
  const db = await initDB();
  const tx = db.transaction('user', 'readwrite');
  await tx.objectStore('user').clear();
  await tx.objectStore('user').put(user);
  await tx.done;
};

export const getUser = async () => {
  const db = await initDB();
  const users = await db.getAll('user');
  return users[0];
};

export const addToSyncQueue = async (action: SyncAction) => {
  const db = await initDB();
  return db.add('sync-queue', action);
};

export const getSyncQueue = async () => {
  const db = await initDB();
  return db.getAll('sync-queue');
};

export const removeFromSyncQueue = async (id: number) => {
  const db = await initDB();
  return db.delete('sync-queue', id);
};
