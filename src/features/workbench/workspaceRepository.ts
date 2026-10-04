import { type WorkspaceDocument } from '../../shared/models'
import { migrateDocument } from '../materials/materialCatalog'
import { BrowserStorageService, isWorkspaceDocument, type StorageService } from './storageService'

export interface StoredDocument {
  document: WorkspaceDocument
  migrated: boolean
}

export interface WorkspaceRepository {
  load(): Promise<StoredDocument | null>
  save(document: WorkspaceDocument): Promise<void>
}

export class LocalWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly storage: StorageService = new BrowserStorageService()) {}

  async load(): Promise<StoredDocument | null> {
    try {
      const raw = await this.storage.read()
      if (!raw) return null
      const parsed: unknown = JSON.parse(raw)
      if (!isWorkspaceDocument(parsed)) return null
      return migrateDocument(parsed)
    } catch {
      return null
    }
  }

  async save(document: WorkspaceDocument): Promise<void> {
    await this.storage.write(JSON.stringify(document))
  }
}
