import { describe, expect, it } from 'vitest'
import {
  BUILTIN_DEVICE_DEFINITIONS,
  DEFAULT_CATALOG_STATE,
  DOCUMENT_VERSION,
  createId,
  mergeCatalogStates,
  migrateWorkspaceDocument,
  normalizeCatalogState,
  resolveDefinitions,
  resolvePlacedDevice,
} from '../models'

describe('workspace document migration', () => {
  it('upgrades v1 documents and stamps built-in snapshots without resizing placed items', () => {
    const legacy = {
      version: 1,
      activePlanId: 'plan-1',
      plans: [{
        id: 'plan-1',
        name: '老方案',
        deskWidthMm: 1600,
        deskHeightMm: 800,
        updatedAt: '2026-01-01T00:00:00.000Z',
        items: [{
          id: 'item-1',
          type: 'monitor',
          widthMm: 600,
          heightMm: 240,
          x: 120,
          y: 80,
          rotation: 15,
        }],
      }],
    }
    const migrated = migrateWorkspaceDocument(legacy)
    expect(migrated).not.toBeNull()
    expect(migrated!.version).toBe(DOCUMENT_VERSION)
    const item = migrated!.plans[0].items[0]
    expect(item.widthMm).toBe(600)
    expect(item.heightMm).toBe(240)
    expect(item.snapshot.label).toBe('显示器')
    expect(item.snapshot.shortLabel).toBe('MON')
    expect(item.snapshot.color).toBe('#93b7ff')
    expect(item.snapshot.category).toBe('显示设备')
  })

  it('keeps a custom snapshot exactly as stored, even when its material is missing from the catalog', () => {
    const document = {
      version: 2,
      activePlanId: 'plan-1',
      catalog: DEFAULT_CATALOG_STATE,
      plans: [{
        id: 'plan-1',
        name: '孤例',
        deskWidthMm: 1600,
        deskHeightMm: 800,
        updatedAt: '2026-02-01T00:00:00.000Z',
        items: [{
          id: 'item-9',
          type: 'custom-deleted-tablet',
          widthMm: 333,
          heightMm: 222,
          x: 10,
          y: 20,
          rotation: 0,
          snapshot: { label: '老板的异形键盘', shortLabel: 'BOSS', color: '#123456', category: '收藏' },
        }],
      }],
    }
    const migrated = migrateWorkspaceDocument(document)!
    const item = migrated.plans[0].items[0]
    expect(item.widthMm).toBe(333)
    const resolved = resolvePlacedDevice(item, resolveDefinitions(DEFAULT_CATALOG_STATE))
    expect(resolved.label).toBe('老板的异形键盘')
    expect(resolved.shortLabel).toBe('BOSS')
    expect(resolved.color).toBe('#123456')
    expect(resolved.category).toBe('收藏')
    expect(resolved.unknown).toBe(true)
    expect(resolved.available).toBe(false)
  })

  it('flags retired materials while keeping their snapshot identity', () => {
    const monitor = resolveDefinitions(DEFAULT_CATALOG_STATE).find((device) => device.type === 'monitor')!
    const item = createPlanItem(monitor)
    const deactivated = mergeCatalogStates(DEFAULT_CATALOG_STATE, {
      overrides: { monitor: { active: false } },
      customs: [],
    })
    const resolved = resolvePlacedDevice(item, resolveDefinitions(deactivated))
    expect(resolved.retired).toBe(true)
    expect(resolved.available).toBe(false)
    expect(resolved.label).toBe('显示器')
  })

  it('falls back to a neutral snapshot for unrecognized v1 item types', () => {
    const migrated = migrateWorkspaceDocument({
      version: 1,
      activePlanId: 'plan-1',
      plans: [{
        id: 'plan-1',
        name: 'x',
        deskWidthMm: 1600,
        deskHeightMm: 800,
        updatedAt: new Date().toISOString(),
        items: [{ id: 'item-x', type: 'mystery', widthMm: 100, heightMm: 100, x: 0, y: 0, rotation: 0 }],
      }],
    })!
    const resolved = resolvePlacedDevice(migrated.plans[0].items[0], resolveDefinitions(DEFAULT_CATALOG_STATE))
    expect(resolved.unknown).toBe(true)
    expect(resolved.label).toBe('未知设备')
  })

  it('rejects documents without plans', () => {
    expect(migrateWorkspaceDocument({ version: 1, plans: [], activePlanId: 'x' })).toBeNull()
    expect(migrateWorkspaceDocument(null)).toBeNull()
  })
})

function createPlanItem(definition: (typeof BUILTIN_DEVICE_DEFINITIONS)[number]) {
  return {
    id: createId('item'),
    type: definition.type,
    widthMm: definition.widthMm,
    heightMm: definition.heightMm,
    x: 0,
    y: 0,
    rotation: 0,
    snapshot: { label: definition.label, shortLabel: definition.shortLabel, color: definition.color, category: definition.category },
  }
}

describe('catalog state', () => {
  it('merges embedded customs with the local seed, preferring the newer record', () => {
    const older = { id: 'custom-1', label: '旧手绘板', shortLabel: 'OLD', color: '#ffffff', category: '自定义', widthMm: 100, heightMm: 100, hint: 'h', active: true, createdAt: '2026-01-01T00:00:00.000Z' }
    const newer = { ...older, label: '新手绘板', widthMm: 260, createdAt: '2026-09-01T00:00:00.000Z' }
    const merged = mergeCatalogStates(
      normalizeCatalogState({ customs: [older] }),
      normalizeCatalogState({ customs: [newer] }),
    )
    expect(merged.customs).toHaveLength(1)
    expect(merged.customs[0].label).toBe('新手绘板')
    expect(merged.customs[0].widthMm).toBe(260)
  })

  it('normalizes damaged catalog payloads back to usable defaults', () => {
    const state = normalizeCatalogState({
      overrides: { monitor: { widthMm: 99999, active: 'yes' }, bogus: { widthMm: 10 } },
      customs: [{ id: 'custom-ok', label: '  ', shortLabel: 'OK', color: 'nope', category: '外设', widthMm: 50, heightMm: 5000 }],
    })
    const monitor = resolveDefinitions(state).find((device) => device.type === 'monitor')!
    expect(monitor.widthMm).toBe(2000)
    expect(monitor.active).toBe(true)
    expect(state.customs[0].label).toBe('未命名设备')
    expect(state.customs[0].color).toBe('#9fc1e8')
    expect(state.customs[0].widthMm).toBe(50)
    expect(state.customs[0].heightMm).toBe(2000)
  })
})
