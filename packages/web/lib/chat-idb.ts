const DB_NAME = "chatgpa";
const DB_VERSION = 1;
const STORE_NAME = "chat";

export const IDB_KEYS = {
  store: "store",
  syncCursor: "syncCursor",
  serverMigrated: "serverMigrated",
  localStorageBackup: "localStorageBackup",
} as const;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

export async function idbGet<T>(key: string): Promise<T | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onerror = () => reject(req.error ?? new Error("idb get failed"));
    req.onsuccess = () => {
      resolve((req.result as T | undefined) ?? null);
      db.close();
    };
  });
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).put(value, key);
    req.onerror = () => reject(req.error ?? new Error("idb set failed"));
    req.onsuccess = () => {
      resolve();
      db.close();
    };
  });
}

export async function idbDelete(key: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).delete(key);
    req.onerror = () => reject(req.error ?? new Error("idb delete failed"));
    req.onsuccess = () => {
      resolve();
      db.close();
    };
  });
}
