import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'twokaj_local';
const DB_VERSION = 1;

export interface SyncItem {
  type: 'user' | 'ad' | 'message' | 'gallery';
  action: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
}

export async function initDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('users')) {
        db.createObjectStore('users', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('ads')) {
        db.createObjectStore('ads', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('messages')) {
        db.createObjectStore('messages', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('gallery')) {
        db.createObjectStore('gallery', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('sync_queue')) {
        db.createObjectStore('sync_queue', { keyPath: 'timestamp' });
      }
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv');
      }
    },
  });
}

export async function getLocalUser() {
  const db = await initDB();
  return db.get('kv', 'current_user');
}

export async function setLocalUser(user: any) {
  const db = await initDB();
  return db.put('kv', user, 'current_user');
}

export async function addToSyncQueue(item: Omit<SyncItem, 'timestamp'>) {
  const db = await initDB();
  await db.add('sync_queue', { ...item, timestamp: Date.now() });
}

export async function getSyncQueue() {
  const db = await initDB();
  return db.getAll('sync_queue');
}

export async function clearSyncQueue() {
  const db = await initDB();
  await db.clear('sync_queue');
}
