import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CATALOG_STATE,
  resolveDefinitions,
  snapshotOf,
} from '../../../shared/models'
import {
  countDeviceUsage,
  createMaterialDraft,
  deleteCustomDevice,
  resetBuiltin,
  setBuiltinDimensions,
  setDeviceActive,
  upsertCustomDevice,
  validateDeviceInput,
  type DeviceInput,
} from '../materialsViewModel'

const definitions = resolveDefinitions(DEFAULT_CATALOG_STATE)
const lamp = definitions.find((device) => device.type === 'lamp')!

describe('materials module', () => {
  it('creates a device draft with catalog dimensions and feedback', () => {
    const draft = createMaterialDraft(lamp, 2)
    expect(draft.item.type).toBe('lamp')
    expect(draft.item.widthMm).toBe(180)
    expect(draft.item.snapshot).toEqual(snapshotOf(lamp))
    expect(draft.feedback).toBe('桌面灯已添加')
  })

  it('updates built-in defaults without touching the snapshot placed earlier', () => {
    const draft = createMaterialDraft(lamp, 0)
    const state = setBuiltinDimensions(DEFAULT_CATALOG_STATE, 'lamp', 300, 300)
    const updatedLamp = resolveDefinitions(state).find((device) => device.type === 'lamp')!
    expect(updatedLamp.widthMm).toBe(300)
    // 改默认尺寸不反写已放置设备
    expect(draft.item.widthMm).toBe(180)
    expect(draft.item.snapshot.label).toBe('桌面灯')
  })

  it('deactivates devices and re-enables them through overrides', () => {
    const deactivated = setDeviceActive(DEFAULT_CATALOG_STATE, 'speaker', false)
    expect(resolveDefinitions(deactivated).find((device) => device.type === 'speaker')?.active).toBe(false)
    const reactivated = setDeviceActive(deactivated, 'speaker', true)
    expect(resolveDefinitions(reactivated).find((device) => device.type === 'speaker')?.active).toBe(true)
  })

  it('clears built-in overrides when reset', () => {
    const changed = setBuiltinDimensions(DEFAULT_CATALOG_STATE, 'lamp', 300, 300)
    const reset = resetBuiltin(changed, 'lamp')
    expect(resolveDefinitions(reset).find((device) => device.type === 'lamp')?.widthMm).toBe(180)
  })

  it('adds, edits and deletes custom devices', () => {
    const input: DeviceInput = {
      label: '手绘板',
      shortLabel: 'TAB',
      color: '#a8e0cf',
      category: '数位外设',
      widthMm: 260,
      heightMm: 200,
      hint: '中号',
    }
    const created = upsertCustomDevice(DEFAULT_CATALOG_STATE, input, null)
    expect(created.customs).toHaveLength(1)
    const record = created.customs[0]
    expect(record.id.startsWith('custom-')).toBe(true)
    const edited = upsertCustomDevice(created, { ...input, widthMm: 320 }, record.id)
    expect(edited.customs[0].widthMm).toBe(320)
    const removed = deleteCustomDevice(edited, record.id)
    expect(removed.customs).toHaveLength(0)
  })

  it('rejects duplicate names and short labels', () => {
    expect(validateDeviceInput(
      { label: '显示器', shortLabel: 'WHATEVER', color: '#fff', category: 'c', widthMm: 100, heightMm: 100 },
      DEFAULT_CATALOG_STATE,
      null,
    ).some((error) => error.field === 'label')).toBe(true)
    expect(validateDeviceInput(
      { label: '新手绘板', shortLabel: 'MON', color: '#fff', category: 'c', widthMm: 100, heightMm: 100 },
      DEFAULT_CATALOG_STATE,
      null,
    ).some((error) => error.field === 'shortLabel')).toBe(true)
  })

  it('counts how many placed items reference each material', () => {
    const draft = createMaterialDraft(lamp, 0)
    const counts = countDeviceUsage([{ items: [draft.item, draft.item] }])
    expect(counts.get('lamp')).toBe(2)
  })
})
