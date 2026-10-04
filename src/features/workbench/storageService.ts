import type { CatalogState } from '../../shared/models'
import { normalizeCatalogState, DEFAULT_CATALOG_STATE } from '../../shared/models'

export const STORAGE_KEY = 'focusdesk.document.v1'
export const CATALOG_STORAGE_KEY = 'focusdesk.catalog.v1'
const DATABASE_NAME = 'focusdesk-db'
const STORE_NAME = 'workspace'

export interface StorageService {
  read(): Promise<string | null>
  write(value: string): Promise<void>
}

export class BrowserStorageService implements StorageService {
  async read(): Promise<string | null> {
    try {
      const database = await openDatabase()
      const value = await readFromDatabase(database)
      database.close()
      return typeof value === 'string' ? value : window.localStorage.getItem(STORAGE_KEY)
    } catch {
      return window.localStorage.getItem(STORAGE_KEY)
    }
  }

  async write(value: string): Promise<void> {
    try {
      const database = await openDatabase()
      await writeToDatabase(database, value)
      database.close()
    } catch {
      window.localStorage.setItem(STORAGE_KEY, value)
    }
  }
}

/** 素材目录的本地种子：新开方案时仍能看到自定义素材，读取失败时静默退回内置素材 */
export interface CatalogStore {
  load(): CatalogState
  save(state: CatalogState): void
}

export class BrowserCatalogStore implements CatalogStore {
  load(): CatalogState {
    try {
      const raw = window.localStorage.getItem(CATALOG_STORAGE_KEY)
      return raw ? normalizeCatalogState(JSON.parse(raw)) : DEFAULT_CATALOG_STATE
    } catch {
      return DEFAULT_CATALOG_STATE
    }
  }

  save(state: CatalogState): void {
    try {
      window.localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(state))
    } catch {
      // 本地存储不可用时素材仍随文档保存，不阻断编辑
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

function readFromDatabase(database: IDBDatabase): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(STORAGE_KEY)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed'))
  })
}

function writeToDatabase(database: IDBDatabase, value: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(value, STORAGE_KEY)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error('IndexedDB write failed'))
  })
}
