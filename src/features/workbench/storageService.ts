import type { WorkspaceDocument } from '../../shared/models'

export const STORAGE_KEY = 'focusdesk.document.v2'
const LEGACY_STORAGE_KEY = 'focusdesk.document.v1'
const DATABASE_NAME = 'focusdesk-db'
const STORE_NAME = 'workspace'

export interface StorageService {
  read(): Promise<string | null>
  write(value: string): Promise<void>
}

export class BrowserStorageService implements StorageService {
  constructor(private readonly key: string = STORAGE_KEY) {}

  async read(): Promise<string | null> {
    // 新 key 未命中时回退 v1 key，老用户升级后能直接迁移原方案
    const keys = this.key === STORAGE_KEY ? [STORAGE_KEY, LEGACY_STORAGE_KEY] : [this.key]
    try {
      const database = await openDatabase()
      for (const candidateKey of keys) {
        const value = await readFromDatabase(database, candidateKey)
        if (typeof value === 'string') {
          database.close()
          return value
        }
      }
      database.close()
    } catch {
      // IndexedDB 不可用时落到 localStorage
    }
    for (const candidateKey of keys) {
      const local = window.localStorage.getItem(candidateKey)
      if (local) return local
    }
    return null
  }

  async write(value: string): Promise<void> {
    try {
      const database = await openDatabase()
      await writeToDatabase(database, this.key, value)
      database.close()
    } catch {
      window.localStorage.setItem(this.key, value)
    }
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
  })
}

function readFromDatabase(database: IDBDatabase, key: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed'))
  })
}

function writeToDatabase(database: IDBDatabase, key: string, value: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(value, key)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error('IndexedDB write failed'))
  })
}

export function isWorkspaceDocument(value: unknown): value is WorkspaceDocument {
  if (!value || typeof value !== 'object') return false
  const candidate = value as { version?: number; plans?: unknown; activePlanId?: unknown }
  return (candidate.version === 1 || candidate.version === 2)
    && Array.isArray(candidate.plans)
    && typeof candidate.activePlanId === 'string'
}
