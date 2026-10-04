import { describe, expect, it } from 'vitest'
import { LocalWorkspaceRepository } from '../workspaceRepository'
import type { CatalogStore, StorageService } from '../storageService'
import { createInitialDocument, DEFAULT_CATALOG_STATE, migrateWorkspaceDocument, resolveDefinitions, type CatalogState } from '../../../shared/models'

function memoryStorage(initial: string | null = null): StorageService {
  let value = initial
  return { read: async () => value, write: async (next) => { value = next } }
}

function memoryCatalogStore(initial: CatalogState = DEFAULT_CATALOG_STATE): CatalogStore & { snapshot: () => CatalogState } {
  let value = initial
  return {
    load: () => value,
    save: (next) => { value = next },
    snapshot: () => value,
  }
}

describe('local workspace repository', () => {
  it('round trips a document', async () => {
    const catalogStore = memoryCatalogStore()
    const repository = new LocalWorkspaceRepository(memoryStorage(), catalogStore)
    const document = createInitialDocument()
    await repository.save(document)
    await expect(repository.load()).resolves.toEqual(document)
    expect(catalogStore.snapshot()).toEqual(document.catalog)
  })

  it('falls back when stored JSON is damaged', async () => {
    const repository = new LocalWorkspaceRepository(memoryStorage('{broken'), memoryCatalogStore())
    await expect(repository.load()).resolves.toBeNull()
  })

  it('migrates v1 documents, preserving placed dimensions and stamping snapshots', async () => {
    const legacy = JSON.stringify({
      version: 1,
      activePlanId: 'plan-1',
      plans: [{
        id: 'plan-1',
        name: '老方案',
        deskWidthMm: 1600,
        deskHeightMm: 800,
        updatedAt: new Date().toISOString(),
        items: [
          { id: 'a', type: 'monitor', widthMm: 700, heightMm: 260, x: 10, y: 10, rotation: 0 },
          { id: 'b', type: 'keyboard', widthMm: 500, heightMm: 160, x: 10, y: 400, rotation: 0 },
        ],
      }],
    })
    const repository = new LocalWorkspaceRepository(memoryStorage(legacy), memoryCatalogStore())
    const loaded = await repository.load()
    expect(loaded).not.toBeNull()
    expect(loaded!.version).toBe(2)
    const items = loaded!.plans[0].items
    expect(items.map((item) => [item.widthMm, item.heightMm])).toEqual([[700, 260], [500, 160]])
    expect(items[0].snapshot.label).toBe('显示器')
    expect(items[1].snapshot.label).toBe('键盘')
  })

  it('merges local custom materials into a document without them', async () => {
    const local: CatalogState = {
      overrides: {},
      customs: [{
        id: 'custom-tablet',
        label: '手绘板',
        shortLabel: 'TAB',
        color: '#a8e0cf',
        category: '数位外设',
        widthMm: 260,
        heightMm: 200,
        hint: '中号',
        active: true,
        createdAt: '2026-03-01T00:00:00.000Z',
      }],
    }
    const repository = new LocalWorkspaceRepository(memoryStorage(JSON.stringify(createInitialDocument())), memoryCatalogStore(local))
    const loaded = await repository.load()
    expect(loaded!.catalog.customs.map((record) => record.id)).toContain('custom-tablet')
    expect(resolveDefinitions(loaded!.catalog).some((device) => device.type === 'custom-tablet' && device.active)).toBe(true)
  })
})

describe('migration guard', () => {
  it('keeps migrated documents re-parseable through the same path', () => {
    const migrated = migrateWorkspaceDocument({
      version: 1,
      activePlanId: 'p',
      plans: [{ id: 'p', name: 'n', deskWidthMm: 1000, deskHeightMm: 700, items: [], updatedAt: new Date().toISOString() }],
    })
    expect(migrated!.catalog).toEqual(DEFAULT_CATALOG_STATE)
  })
})
