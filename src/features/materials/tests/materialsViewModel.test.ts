import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CATALOG,
  addCustomCategory,
  addCustomDevice,
  deriveShortLabel,
  getDefinition,
  getDefinitionStatus,
  groupDevicesByCategory,
  migrateDocument,
  removeCustomDevice,
  resolveCatalog,
  setBuiltinOverride,
  updateCustomDevice,
} from '../materialCatalog'
import { createMaterialDraft } from '../materialsViewModel'

describe('materials module', () => {
  it('creates a device draft with catalog definition dimensions and feedback', () => {
    const lamp = getDefinition(DEFAULT_CATALOG, 'lamp')
    const draft = createMaterialDraft(lamp, 2)
    expect(draft.item.type).toBe('lamp')
    expect(draft.item.widthMm).toBe(180)
    expect(draft.item.label).toBe('桌面灯')
    expect(draft.item.color).toBe('#ffd58e')
    expect(draft.feedback).toBe('桌面灯已添加')
  })

  it('keeps placed instances frozen when catalog defaults change later', () => {
    // 先按 540 放下一台显示器
    const placed = createMaterialDraft(getDefinition(DEFAULT_CATALOG, 'monitor'), 0).item
    expect(placed.widthMm).toBe(540)

    // 之后素材库里把显示器默认宽度调到 800 并停用
    const changed = setBuiltinOverride(DEFAULT_CATALOG, 'monitor', { widthMm: 800, disabled: true })

    // 老实例尺寸、外观不变，照样画得出来；新默认只影响以后添加
    expect(placed.widthMm).toBe(540)
    expect(placed.label).toBe('显示器')
    expect(getDefinition(changed, 'monitor').widthMm).toBe(800)
  })

  it('derives a short label from unicode letters and digits', () => {
    expect(deriveShortLabel('洞洞 板')).toBe('洞洞板')
    expect(deriveShortLabel('usb hub')).toBe('USBH')
    expect(deriveShortLabel('---')).toBe('CUS')
  })
})

describe('material catalog', () => {
  it('adds custom devices with a new category and groups them for the palette', () => {
    const withCategory = addCustomCategory(DEFAULT_CATALOG, '收纳')
    const result = addCustomDevice(withCategory.catalog, {
      label: '洞洞板',
      widthMm: 400,
      heightMm: 120,
      color: '#a8d5a2',
      categoryId: withCategory.category.id,
    })
    const { categories, devices } = resolveCatalog(result.catalog)
    expect(categories.some((category) => category.label === '收纳')).toBe(true)
    const created = devices.find((device) => device.kind === result.device.kind)
    expect(created).toMatchObject({ label: '洞洞板', shortLabel: '洞洞板', builtin: false, disabled: false })
    expect(getDefinitionStatus(result.catalog, result.device.kind)).toBe('custom')

    const groups = groupDevicesByCategory(devices, categories)
    const storageGroup = groups.find((group) => group.category.label === '收纳')
    expect(storageGroup?.devices.map((device) => device.kind)).toContain(result.device.kind)
  })

  it('changes built-in default size without touching other built-ins', () => {
    const updated = setBuiltinOverride(DEFAULT_CATALOG, 'monitor', { widthMm: 700 })
    expect(getDefinition(updated, 'monitor').widthMm).toBe(700)
    expect(getDefinition(updated, 'keyboard').widthMm).toBe(440)
  })

  it('hides disabled built-ins from palette groups but keeps them resolvable', () => {
    const disabled = setBuiltinOverride(DEFAULT_CATALOG, 'speaker', { disabled: true })
    const { devices, categories } = resolveCatalog(disabled)
    const groups = groupDevicesByCategory(devices, categories)
    const kinds = groups.flatMap((group) => group.devices.map((device) => device.kind))
    expect(kinds).not.toContain('speaker')
    expect(getDefinitionStatus(disabled, 'speaker')).toBe('builtin-disabled')
  })

  it('cleans up overrides once built-in values return to defaults', () => {
    const updated = setBuiltinOverride(DEFAULT_CATALOG, 'monitor', { widthMm: 700, disabled: true })
    const restored = setBuiltinOverride(updated, 'monitor', { widthMm: 540, disabled: false })
    expect(restored.builtinOverrides.monitor).toBeUndefined()
  })

  it('updates and removes custom devices', () => {
    const added = addCustomDevice(DEFAULT_CATALOG, {
      label: '手绘板', widthMm: 300, heightMm: 210, color: '#9fd8e8', categoryId: 'input',
    })
    const edited = updateCustomDevice(added.catalog, added.device.kind, { label: '数位屏', widthMm: 360 })
    expect(getDefinition(edited, added.device.kind)).toMatchObject({ label: '数位屏', widthMm: 360 })
    const removed = removeCustomDevice(edited, added.device.kind)
    expect(getDefinitionStatus(removed, added.device.kind)).toBe('missing')
  })

  it('reports unknown kinds as missing', () => {
    expect(getDefinitionStatus(DEFAULT_CATALOG, 'ghost-device')).toBe('missing')
    const fallback = getDefinition(DEFAULT_CATALOG, 'ghost-device')
    expect(fallback.color).toBeTruthy()
  })
})

describe('document migration', () => {
  it('snapshots v1 item identity and keeps the original size and pose untouched', () => {
    const v1 = {
      version: 1,
      activePlanId: 'p1',
      plans: [{
        id: 'p1',
        name: '老方案',
        deskWidthMm: 1600,
        deskHeightMm: 800,
        updatedAt: '2026-01-01T00:00:00.000Z',
        items: [{
          id: 'old-1', type: 'monitor', widthMm: 500, heightMm: 200,
          x: 120, y: 80, rotation: 30,
        }],
      }],
    }
    const { document, migrated } = migrateDocument(v1)
    expect(migrated).toBe(true)
    expect(document.version).toBe(2)
    const item = document.plans[0].items[0]
    expect(item).toMatchObject({
      id: 'old-1', type: 'monitor', widthMm: 500, heightMm: 200, x: 120, y: 80, rotation: 30,
      label: '显示器', shortLabel: 'MON', color: '#93b7ff', categoryId: 'display',
    })
  })

  it('migrates an item whose type no longer exists by falling back to identifiable defaults', () => {
    const v1 = {
      version: 1,
      activePlanId: 'p1',
      plans: [{ id: 'p1', name: 'x', deskWidthMm: 1600, deskHeightMm: 800, updatedAt: '', items: [
        { id: 'lost-1', type: 'retro-gadget', widthMm: 240, heightMm: 240, x: 0, y: 0, rotation: 0 },
      ] }],
    }
    const item = migrateDocument(v1).document.plans[0].items[0]
    expect(item.label).toBe('未知设备')
    expect(item.shortLabel).toBe('RETR')
    expect(item.color).toBeTruthy()
  })

  it('does not mark a v2 document as migrated', () => {
    const v2 = {
      version: 2,
      activePlanId: 'p1',
      plans: [{ id: 'p1', name: 'x', deskWidthMm: 1600, deskHeightMm: 800, updatedAt: '', items: [] }],
    }
    expect(migrateDocument(v2).migrated).toBe(false)
  })
})
