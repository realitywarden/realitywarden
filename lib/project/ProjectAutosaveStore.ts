const databaseName = 'realitywarden-projects';
const databaseVersion = 1;
const storeName = 'autosaves';
const autosaveKey = 'current-project';

export const LEGACY_AUTOSAVE_KEY = 'open-reality-studio:last-workspace';

export interface ProjectAutosaveRecord {
  text: string;
  source: 'indexeddb' | 'legacy-localstorage';
}

export interface ProjectAutosaveBackend {
  get(): Promise<string | undefined>;
  put(text: string): Promise<void>;
  delete(): Promise<void>;
}

export interface LegacyAutosaveStorage {
  getItem(key: string): string | null;
  removeItem(key: string): void;
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed.'));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(storeName)) database.createObjectStore(storeName);
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
    request.onsuccess = () => resolve(request.result);
  });
}

async function withStore<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(storeName, mode);
    const result = await requestResult(operation(transaction.objectStore(storeName)));
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
    });
    return result;
  } finally {
    database.close();
  }
}

export function createProjectAutosaveService(backend: ProjectAutosaveBackend, legacyStorage: LegacyAutosaveStorage) {
  return {
    async load(): Promise<ProjectAutosaveRecord | null> {
      try {
        const value = await backend.get();
        if (typeof value === 'string') return { text: value, source: 'indexeddb' };
      } catch (error) {
        const legacy = legacyStorage.getItem(LEGACY_AUTOSAVE_KEY);
        if (legacy !== null) return { text: legacy, source: 'legacy-localstorage' };
        throw error;
      }
      const legacy = legacyStorage.getItem(LEGACY_AUTOSAVE_KEY);
      return legacy === null ? null : { text: legacy, source: 'legacy-localstorage' };
    },
    async save(text: string) {
      await backend.put(text);
      legacyStorage.removeItem(LEGACY_AUTOSAVE_KEY);
    },
    async discard() {
      await backend.delete();
      legacyStorage.removeItem(LEGACY_AUTOSAVE_KEY);
    }
  };
}

function browserAutosaveService() {
  const backend: ProjectAutosaveBackend = {
    get: () => withStore('readonly', (store) => store.get(autosaveKey)) as Promise<string | undefined>,
    put: async (text) => { await withStore('readwrite', (store) => store.put(text, autosaveKey)); },
    delete: async () => { await withStore('readwrite', (store) => store.delete(autosaveKey)); }
  };
  return createProjectAutosaveService(backend, window.localStorage);
}

export const loadProjectAutosave = () => browserAutosaveService().load();
export const saveProjectAutosave = (text: string) => browserAutosaveService().save(text);
export const discardProjectAutosave = () => browserAutosaveService().discard();
