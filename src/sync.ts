import { initDB, getSyncQueue, clearSyncQueue } from './services/db';

async function syncData() {
  if (!navigator.onLine) return;

  const queue = await getSyncQueue();
  if (queue.length === 0) return;

  const users = queue.filter(i => i.type === 'user').map(i => i.data);
  const ads = queue.filter(i => i.type === 'ad').map(i => i.data);
  const messages = queue.filter(i => i.type === 'message').map(i => i.data);

  try {
    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ users, ads, messages })
    });

    if (response.ok) {
      await clearSyncQueue();
      console.log('Sync successful');
    }
  } catch (error) {
    console.error('Sync failed', error);
  }
}

// Simple sync loop
setInterval(syncData, 30000); // Every 30 seconds
window.addEventListener('online', syncData);
