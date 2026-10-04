import {
  mergeCatalogStates,
  migrateWorkspaceDocument,
  type WorkspaceDocument,
} from '../../shared/models'
import { BrowserCatalogStore, BrowserStorageService, type CatalogStore, type StorageService } from './storageService'

export interface WorkspaceRepository {
  load(): Promise<WorkspaceDocument | null>
  save(document: WorkspaceDocument): Promise<void>
}

export class LocalWorkspaceRepository implements WorkspaceRepository {
  constructor(
    private readonly storage: StorageService = new BrowserStorageService(),
    private readonly catalogStore: CatalogStore = new BrowserCatalogStore(),
  ) {}

  async load(): Promise<WorkspaceDocument | null> {
    try {
      const raw = await this.storage.read()
      if (!raw) return null
      const migrated = migrateWorkspaceDocument(JSON.parse(raw))
      if (!migrated) return null
      // 文档自带素材与本地种子合并：在别的浏览器里新建的自定义素材也能显示、可编辑
      const localCatalog = this.catalogStore.load()
      return { ...migrated, catalog: mergeCatalogStates(localCatalog, migrated.catalog) }
    } catch {
      return null
    }
  }

  async save(document: WorkspaceDocument): Promise<void> {
    await this.storage.write(JSON.stringify(document))
    this.catalogStore.save(document.catalog)
  }
}
