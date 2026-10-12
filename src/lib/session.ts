import type { Contact } from '../types/contact';
export interface SavedSession {
  version: 1;
  contacts: Contact[];
  selected: string[];
  filename: string;
  warnings: string[];
  savedAt: number;
}
const dbName = 'contacts-minus';
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('session');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Browser storage is unavailable.'));
    request.onblocked = () => reject(new Error('Browser storage is blocked by another tab.'));
  });
}
async function transaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('session', mode);
    const request = operation(tx.objectStore('session'));
    tx.oncomplete = () => {
      db.close();
      resolve(request.result);
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(new Error('Your browser could not save progress. Storage may be full or disabled.'));
    };
  });
}
// Serialize writes so a clear operation cannot be overtaken by an earlier autosave.
let writes: Promise<unknown> = Promise.resolve();
export function saveSession(session: SavedSession): Promise<unknown> {
  writes = writes
    .catch(() => {})
    .then(() => transaction('readwrite', (store) => store.put(session, 'current')));
  return writes;
}
export function clearSession(): Promise<unknown> {
  writes = writes
    .catch(() => {})
    .then(() => transaction('readwrite', (store) => store.delete('current')));
  return writes;
}
export async function loadSession(): Promise<SavedSession | undefined> {
  const saved = await transaction<SavedSession | undefined>('readonly', (store) =>
    store.get('current'),
  );
  if (
    saved &&
    (saved.version !== 1 || !Array.isArray(saved.contacts) || !Array.isArray(saved.selected))
  )
    throw new Error(
      'Saved progress could not be restored. Clear this site’s browser storage to start again.',
    );
  return saved;
}
