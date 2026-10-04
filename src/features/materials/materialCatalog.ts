import {
  BUILTIN_DEVICE_CATEGORIES,
  BUILTIN_DEVICE_DEFINITIONS,
  createId,
  fallbackDefinition,
  findBuiltinDefinition,
  getItemIdentity,
  type DeviceCategory,
  type DeviceDefinition,
  type DeviceKind,
  type DeskItem,
  type WorkspaceDocument,
} from '../../shared/models'
import { clampDeskSize, clampItemDimension } from '../../shared/layoutRules'

export interface DeviceInput {
  label: string
  widthMm: number
  heightMm: number
  color: string
  categoryId: string
  shortLabel?: string
  hint?: string
}

/** 内置素材可改的只有默认尺寸与停用状态；名称 / 配色 / 分类保持产品口径。 */
export interface BuiltinDeviceOverride {
  widthMm?: number
  heightMm?: number
  disabled?: boolean
}

export interface MaterialCatalog {
  version: 1
  customDevices: DeviceDefinition[]
  customCategories: DeviceCategory[]
  builtinOverrides: Record<string, BuiltinDeviceOverride>
}

export const DEFAULT_CATALOG: MaterialCatalog = {
  version: 1,
  customDevices: [],
  customCategories: [],
  builtinOverrides: {},
}

/** 名称里取字母数字（支持中文）生成简称，纯符号时回退 CUS。 */
export function deriveShortLabel(label: string): string {
  const compact = label.replace(/\s+/g, '').toUpperCase()
  const chars = [...compact].filter((char) => /[\p{L}\p{N}]/u.test(char))
  if (chars.length === 0) return 'CUS'
  return chars.slice(0, 4).join('')
}

function applyBuiltinOverride(definition: DeviceDefinition, override: BuiltinDeviceOverride | undefined): DeviceDefinition {
  if (!override) return definition
  return {
    ...definition,
    widthMm: override.widthMm === undefined ? definition.widthMm : clampItemDimension(override.widthMm, definition.widthMm),
    heightMm: override.heightMm === undefined ? definition.heightMm : clampItemDimension(override.heightMm, definition.heightMm),
    disabled: override.disabled ?? definition.disabled,
  }
}

export function resolveCatalog(catalog: MaterialCatalog): {
  categories: DeviceCategory[]
  devices: DeviceDefinition[]
} {
  const overrides = catalog.builtinOverrides ?? {}
  const builtins = BUILTIN_DEVICE_DEFINITIONS.map((definition) =>
    applyBuiltinOverride(definition, overrides[definition.kind]),
  )
  const customs = catalog.customDevices ?? []
  const builtinCategoryIds = new Set(BUILTIN_DEVICE_CATEGORIES.map((category) => category.id))
  const categories = [
    ...BUILTIN_DEVICE_CATEGORIES,
    ...(catalog.customCategories ?? []).filter((category) => !builtinCategoryIds.has(category.id)),
  ]
  return { categories, devices: [...builtins, ...customs] }
}

/** 面板按分类浏览时使用：停用的不进面板；未知分类归入“其他”。 */
export function groupDevicesByCategory(
  devices: DeviceDefinition[],
  categories: DeviceCategory[],
): { category: DeviceCategory; devices: DeviceDefinition[] }[] {
  const available = devices.filter((device) => !device.disabled)
  const categoryMap = new Map(categories.map((category) => [category.id, category]))
  const other: DeviceCategory = { id: 'other', label: '其他', builtin: true }
  const groups = new Map<string, DeviceDefinition[]>()
  available.forEach((device) => {
    const id = categoryMap.has(device.categoryId) ? device.categoryId : 'other'
    const list = groups.get(id)
    if (list) list.push(device)
    else groups.set(id, [device])
  })
  const ordered = [...categories, other].filter((category, index, all) =>
    groups.has(category.id) && all.findIndex((item) => item.id === category.id) === index,
  )
  return ordered.map((category) => ({ category, devices: groups.get(category.id) ?? [] }))
}

export function getDefinition(catalog: MaterialCatalog, kind: DeviceKind): DeviceDefinition {
  const { devices } = resolveCatalog(catalog)
  return devices.find((device) => device.kind === kind) ?? findBuiltinDefinition(kind) ?? fallbackDefinition(kind)
}

export function getDefinitionStatus(
  catalog: MaterialCatalog,
  kind: DeviceKind,
): 'custom' | 'builtin' | 'builtin-disabled' | 'missing' {
  const { devices } = resolveCatalog(catalog)
  const device = devices.find((entry) => entry.kind === kind)
  if (device) {
    if (!device.builtin) return 'custom'
    return device.disabled ? 'builtin-disabled' : 'builtin'
  }
  return 'missing'
}

export function addCustomDevice(catalog: MaterialCatalog, input: DeviceInput): {
  catalog: MaterialCatalog
  device: DeviceDefinition
} {
  const label = input.label.trim() || '未命名设备'
  const shortLabel = (input.shortLabel?.trim() || deriveShortLabel(label)).slice(0, 6)
  const device: DeviceDefinition = {
    kind: createId('device'),
    label,
    shortLabel,
    widthMm: clampItemDimension(input.widthMm, 200),
    heightMm: clampItemDimension(input.heightMm, 200),
    color: input.color,
    hint: input.hint?.trim() || '自定义设备',
    categoryId: input.categoryId,
    builtin: false,
    disabled: false,
  }
  return {
    catalog: { ...catalog, customDevices: [...catalog.customDevices, device] },
    device,
  }
}

export function updateCustomDevice(
  catalog: MaterialCatalog,
  kind: DeviceKind,
  patch: Partial<DeviceInput>,
): MaterialCatalog {
  return {
    ...catalog,
    customDevices: catalog.customDevices.map((device) => {
      if (device.kind !== kind) return device
      const label = patch.label === undefined ? device.label : (patch.label.trim() || device.label)
      const shortLabel = patch.shortLabel === undefined
        ? device.shortLabel
        : (patch.shortLabel.trim() || deriveShortLabel(label))
      return {
        ...device,
        label,
        shortLabel: (shortLabel || deriveShortLabel(label)).slice(0, 6),
        widthMm: patch.widthMm === undefined ? device.widthMm : clampItemDimension(patch.widthMm, device.widthMm),
        heightMm: patch.heightMm === undefined ? device.heightMm : clampItemDimension(patch.heightMm, device.heightMm),
        color: patch.color ?? device.color,
        categoryId: patch.categoryId ?? device.categoryId,
        hint: patch.hint === undefined ? device.hint : (patch.hint.trim() || device.hint),
      }
    }),
  }
}

export function removeCustomDevice(catalog: MaterialCatalog, kind: DeviceKind): MaterialCatalog {
  return { ...catalog, customDevices: catalog.customDevices.filter((device) => device.kind !== kind) }
}

export function setBuiltinOverride(
  catalog: MaterialCatalog,
  kind: DeviceKind,
  patch: BuiltinDeviceOverride,
): MaterialCatalog {
  const current = catalog.builtinOverrides[kind] ?? {}
  const next: BuiltinDeviceOverride = {
    widthMm: patch.widthMm === undefined ? current.widthMm : clampItemDimension(patch.widthMm, patch.widthMm),
    heightMm: patch.heightMm === undefined ? current.heightMm : clampItemDimension(patch.heightMm, patch.heightMm),
    disabled: patch.disabled === undefined ? current.disabled : patch.disabled,
  }
  const builtin = findBuiltinDefinition(kind)
  const isClean = (!builtin || (next.widthMm === undefined || next.widthMm === builtin.widthMm))
    && (!builtin || (next.heightMm === undefined || next.heightMm === builtin.heightMm))
    && (next.disabled === undefined || next.disabled === false)
  const overrides = { ...catalog.builtinOverrides }
  if (isClean) delete overrides[kind]
  else overrides[kind] = next
  return { ...catalog, builtinOverrides: overrides }
}

export function addCustomCategory(catalog: MaterialCatalog, label: string): {
  catalog: MaterialCatalog
  category: DeviceCategory
} {
  const trimmed = label.trim()
  const existing = resolveCatalog(catalog).categories.find((category) => category.label === trimmed)
  if (existing) return { catalog, category: existing }
  const category: DeviceCategory = { id: createId('category'), label: trimmed || '新分类', builtin: false }
  return {
    catalog: { ...catalog, customCategories: [...catalog.customCategories, category] },
    category,
  }
}

type LegacyItem = Record<string, unknown>

/**
 * v1 方案迁移：老设备只有 type + 尺寸，没有身份字段。
 * 用放下那一刻的内置资料快照补齐外观，只补不改 —— 尺寸 / 位置 / 旋转原样保留，
 * 之后即使目录里的默认尺寸被改掉，也追不到这些老设备。
 */
export function migrateDocument(raw: unknown): { document: WorkspaceDocument; migrated: boolean } {
  if (!raw || typeof raw !== 'object') throw new Error('invalid document')
  const candidate = raw as LegacyItem
  const version = candidate.version === 2 ? 2 : 1
  if (!Array.isArray(candidate.plans) || typeof candidate.activePlanId !== 'string') {
    throw new Error('invalid document')
  }
  const plans = candidate.plans.map((rawPlan) => {
    const plan = (rawPlan ?? {}) as LegacyItem
    const items = Array.isArray(plan.items) ? plan.items.map((rawItem) => {
      const item = (rawItem ?? {}) as LegacyItem
      const type = String(item.type ?? '')
      const identity = getItemIdentity({ ...item, type } as Partial<DeskItem> & { type: DeviceKind })
      return {
        ...identity,
        id: String(item.id ?? createId('item')),
        type,
        widthMm: clampItemDimension(Number(item.widthMm), 200),
        heightMm: clampItemDimension(Number(item.heightMm), 200),
        x: Number.isFinite(Number(item.x)) ? Number(item.x) : 0,
        y: Number.isFinite(Number(item.y)) ? Number(item.y) : 0,
        rotation: Number.isFinite(Number(item.rotation)) ? Number(item.rotation) : 0,
      }
    }) : []
    return {
      id: String(plan.id ?? createId('plan')),
      name: String(plan.name ?? '我的工作台'),
      deskWidthMm: clampDeskSize(Number(plan.deskWidthMm), 1600),
      deskHeightMm: clampDeskSize(Number(plan.deskHeightMm), 800),
      items,
      updatedAt: String(plan.updatedAt ?? new Date().toISOString()),
    }
  })
  return {
    document: { version: 2, plans, activePlanId: candidate.activePlanId as string },
    migrated: version === 1,
  }
}
