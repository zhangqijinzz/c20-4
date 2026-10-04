import {
  createId,
  createItemFromDefinition,
  isBuiltinDeviceType,
  type CatalogState,
  type CustomDeviceRecord,
  type DeviceDefinition,
  type DeviceInput,
  type DeviceInputError,
  type DeviceType,
  type DeskItem,
  validateDeviceInput,
} from '../../shared/models'

export interface MaterialDraft {
  item: DeskItem
  feedback: string
}

export function createMaterialDraft(definition: DeviceDefinition, currentItemCount: number): MaterialDraft {
  return {
    item: createItemFromDefinition(definition, currentItemCount),
    feedback: `${definition.label}已添加`,
  }
}

/** 统计各素材在所有方案中的使用数量，删除/停用前给出依据 */
export function countDeviceUsage(documents: Array<{ items: DeskItem[] }>): Map<string, number> {
  const counts = new Map<string, number>()
  for (const plan of documents) {
    for (const item of plan.items) {
      counts.set(item.type, (counts.get(item.type) ?? 0) + 1)
    }
  }
  return counts
}

/** 停用/启用：内置素材写入覆盖项，自定义素材直接改记录 */
export function setDeviceActive(state: CatalogState, type: string, active: boolean): CatalogState {
  if (isBuiltinDeviceType(type)) {
    return {
      ...state,
      overrides: { ...state.overrides, [type]: { ...state.overrides[type], active } },
    }
  }
  return { ...state, customs: state.customs.map((record) => record.id === type ? { ...record, active } : record) }
}

/** 调整内置素材默认尺寸（仅影响之后新放置的设备） */
export function setBuiltinDimensions(state: CatalogState, type: DeviceType, widthMm: number, heightMm: number): CatalogState {
  return {
    ...state,
    overrides: { ...state.overrides, [type]: { ...state.overrides[type], widthMm, heightMm } },
  }
}

/** 恢复内置素材默认：删除该内置项的全部覆盖（尺寸 + 停用） */
export function resetBuiltin(state: CatalogState, type: DeviceType): CatalogState {
  const overrides = { ...state.overrides }
  delete overrides[type]
  return { ...state, overrides }
}

export function upsertCustomDevice(state: CatalogState, input: DeviceInput, editingId: string | null): CatalogState {
  if (editingId) {
    return {
      ...state,
      customs: state.customs.map((record) => record.id === editingId ? {
        ...record,
        label: input.label,
        shortLabel: input.shortLabel,
        color: input.color,
        category: input.category,
        widthMm: input.widthMm,
        heightMm: input.heightMm,
        hint: input.hint?.trim() || '自定义设备',
      } : record),
    }
  }
  const record: CustomDeviceRecord = {
    id: createId('custom'),
    label: input.label,
    shortLabel: input.shortLabel,
    color: input.color,
    category: input.category,
    widthMm: input.widthMm,
    heightMm: input.heightMm,
    hint: input.hint?.trim() || '自定义设备',
    active: true,
    createdAt: new Date().toISOString(),
  }
  return { ...state, customs: [...state.customs, record] }
}

/** 删除自定义素材；调用方需先用 countDeviceUsage 确认没有方案引用 */
export function deleteCustomDevice(state: CatalogState, id: string): CatalogState {
  return { ...state, customs: state.customs.filter((record) => record.id !== id) }
}

export type { DeviceInput, DeviceInputError }
export { validateDeviceInput }
