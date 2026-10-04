import { clampItemDimension } from './limits'

export type DeviceType = 'monitor' | 'keyboard' | 'lamp' | 'speaker' | 'stand'

/** 内置素材的分类顺序与名称 */
export const BUILTIN_CATEGORIES = ['显示设备', '输入设备', '桌面配件', '音频设备'] as const
/** 用户未指定分类时的兜底分类 */
export const CUSTOM_CATEGORY = '自定义'

export interface DeviceSnapshot {
  label: string
  shortLabel: string
  color: string
  category: string
}

export interface DeviceDefinition extends DeviceSnapshot {
  type: string
  widthMm: number
  heightMm: number
  hint: string
  active: boolean
  builtin: boolean
}

/** 内置素材允许被调整的字段：默认尺寸与停用状态 */
export interface BuiltinDeviceOverride {
  widthMm?: number
  heightMm?: number
  active?: boolean
}

export interface CustomDeviceRecord {
  id: string
  label: string
  shortLabel: string
  color: string
  category: string
  widthMm: number
  heightMm: number
  hint: string
  active: boolean
  createdAt: string
}

export interface CatalogState {
  overrides: Partial<Record<DeviceType, BuiltinDeviceOverride>>
  customs: CustomDeviceRecord[]
}

export const BUILTIN_DEVICE_DEFINITIONS: Array<Omit<DeviceDefinition, 'active' | 'builtin'>> = [
  { type: 'monitor', label: '显示器', shortLabel: 'MON', widthMm: 540, heightMm: 210, color: '#93b7ff', category: '显示设备', hint: '主屏 / 副屏' },
  { type: 'keyboard', label: '键盘', shortLabel: 'KEY', widthMm: 440, heightMm: 150, color: '#b5ead7', category: '输入设备', hint: '全尺寸 / 75%' },
  { type: 'lamp', label: '桌面灯', shortLabel: 'LAMP', widthMm: 180, heightMm: 180, color: '#ffd58e', category: '桌面配件', hint: '灯座占用' },
  { type: 'speaker', label: '音箱', shortLabel: 'SPK', widthMm: 150, heightMm: 150, color: '#f4b7d4', category: '音频设备', hint: '左右声道' },
  { type: 'stand', label: '支架', shortLabel: 'STAND', widthMm: 260, heightMm: 180, color: '#cbb7f7', category: '桌面配件', hint: '支架 / 坞站' },
]

export const DEFAULT_CATALOG_STATE: CatalogState = { overrides: {}, customs: [] }

export function isBuiltinDeviceType(type: string): type is DeviceType {
  return BUILTIN_DEVICE_DEFINITIONS.some((device) => device.type === type)
}

function normalizeOverride(value: unknown): BuiltinDeviceOverride {
  if (!value || typeof value !== 'object') return {}
  const candidate = value as Record<string, unknown>
  const override: BuiltinDeviceOverride = {}
  if (typeof candidate.widthMm === 'number') override.widthMm = clampItemDimension(candidate.widthMm, BUILTIN_DEVICE_DEFINITIONS[0].widthMm)
  if (typeof candidate.heightMm === 'number') override.heightMm = clampItemDimension(candidate.heightMm, BUILTIN_DEVICE_DEFINITIONS[0].heightMm)
  if (typeof candidate.active === 'boolean') override.active = candidate.active
  return override
}

function normalizeColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(value.trim()) ? value.trim() : fallback
}

function normalizeText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  if (!trimmed) return fallback
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed
}

function normalizeCategory(value: unknown): string {
  const category = normalizeText(value, CUSTOM_CATEGORY, 12)
  return category
}

export function normalizeCustomDevice(value: unknown): CustomDeviceRecord | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>
  if (typeof candidate.id !== 'string' || !candidate.id.startsWith('custom-')) return null
  if (isBuiltinDeviceType(candidate.id)) return null
  const label = normalizeText(candidate.label, '未命名设备', 20)
  const shortLabel = normalizeText(candidate.shortLabel, label.slice(0, 4), 8)
  const widthMm = typeof candidate.widthMm === 'number' ? clampItemDimension(candidate.widthMm, 200) : 200
  const heightMm = typeof candidate.heightMm === 'number' ? clampItemDimension(candidate.heightMm, 200) : 200
  return {
    id: candidate.id,
    label,
    shortLabel,
    color: normalizeColor(candidate.color, '#9fc1e8'),
    category: normalizeCategory(candidate.category),
    widthMm,
    heightMm,
    hint: normalizeText(candidate.hint, '自定义设备', 30),
    active: typeof candidate.active === 'boolean' ? candidate.active : true,
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : new Date(0).toISOString(),
  }
}

/** 清洗持久化来源（文档 / 本地种子）中的素材状态，丢弃无法识别的字段 */
export function normalizeCatalogState(value: unknown): CatalogState {
  if (!value || typeof value !== 'object') return DEFAULT_CATALOG_STATE
  const candidate = value as Partial<CatalogState>
  const overrides: CatalogState['overrides'] = {}
  if (candidate.overrides && typeof candidate.overrides === 'object') {
    for (const base of BUILTIN_DEVICE_DEFINITIONS) {
      const raw = (candidate.overrides as Record<string, unknown>)[base.type]
      if (raw) overrides[base.type as DeviceType] = normalizeOverride(raw)
    }
  }
  const customs = Array.isArray(candidate.customs)
    ? candidate.customs.map(normalizeCustomDevice).filter((record): record is CustomDeviceRecord => record !== null)
    : []
  return { overrides, customs }
}

/** 文档素材与本地种子合并：自定义设备按更新时间取较新的一份，内置覆盖逐项合并 */
export function mergeCatalogStates(local: CatalogState, embedded: CatalogState): CatalogState {
  const overrides: CatalogState['overrides'] = { ...local.overrides }
  for (const base of BUILTIN_DEVICE_DEFINITIONS) {
    const embeddedOverride = embedded.overrides[base.type as DeviceType]
    if (!embeddedOverride) continue
    overrides[base.type as DeviceType] = { ...overrides[base.type as DeviceType], ...embeddedOverride }
  }
  const customsById = new Map<string, CustomDeviceRecord>()
  for (const record of [...local.customs, ...embedded.customs]) {
    const existing = customsById.get(record.id)
    if (!existing || record.createdAt >= existing.createdAt) customsById.set(record.id, record)
  }
  return { overrides, customs: [...customsById.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) }
}

/** 素材状态 + 内置定义 -> 完整素材列表（内置在前，自定义在后） */
export function resolveDefinitions(state: CatalogState): DeviceDefinition[] {
  const builtins = BUILTIN_DEVICE_DEFINITIONS.map((base) => {
    const override = state.overrides[base.type as DeviceType]
    return {
      ...base,
      widthMm: override?.widthMm ?? base.widthMm,
      heightMm: override?.heightMm ?? base.heightMm,
      active: override?.active ?? true,
      builtin: true,
    }
  })
  const customs = state.customs.map((record) => ({
    type: record.id,
    label: record.label,
    shortLabel: record.shortLabel,
    color: record.color,
    category: record.category,
    widthMm: record.widthMm,
    heightMm: record.heightMm,
    hint: record.hint,
    active: record.active,
    builtin: false,
  }))
  return [...builtins, ...customs]
}

export interface DeviceInput {
  label: string
  shortLabel: string
  color: string
  category: string
  widthMm: number
  heightMm: number
  hint?: string
}

export interface DeviceInputError {
  field: 'label' | 'shortLabel' | 'color' | 'category' | 'widthMm' | 'heightMm'
  message: string
}

/** 校验新增/编辑表单，同名与同简称冲突时给出错误 */
export function validateDeviceInput(
  input: Partial<DeviceInput>,
  state: CatalogState,
  editingId: string | null,
): DeviceInputError[] {
  const errors: DeviceInputError[] = []
  const label = typeof input.label === 'string' ? input.label.trim() : ''
  const shortLabel = typeof input.shortLabel === 'string' ? input.shortLabel.trim() : ''
  const color = typeof input.color === 'string' ? input.color.trim() : ''
  const category = typeof input.category === 'string' ? input.category.trim() : ''
  if (!label) errors.push({ field: 'label', message: '请填写设备名称' })
  else if (label.length > 20) errors.push({ field: 'label', message: '名称最多 20 个字' })
  if (!shortLabel) errors.push({ field: 'shortLabel', message: '请填写简称' })
  else if (shortLabel.length > 8) errors.push({ field: 'shortLabel', message: '简称最多 8 个字符' })
  if (!color || !/^#[0-9a-fA-F]{3,8}$/.test(color)) errors.push({ field: 'color', message: '请选择配色' })
  if (category.length > 12) errors.push({ field: 'category', message: '分类最多 12 个字' })
  if (input.widthMm === undefined || !Number.isFinite(input.widthMm) || input.widthMm < 40 || input.widthMm > 2000) {
    errors.push({ field: 'widthMm', message: '宽度需在 40–2000 mm 之间' })
  }
  if (input.heightMm === undefined || !Number.isFinite(input.heightMm) || input.heightMm < 40 || input.heightMm > 2000) {
    errors.push({ field: 'heightMm', message: '深度需在 40–2000 mm 之间' })
  }
  const occupiedLabels = new Set<string>()
  const occupiedShortLabels = new Set<string>()
  for (const definition of BUILTIN_DEVICE_DEFINITIONS) {
    occupiedLabels.add(definition.label)
    occupiedShortLabels.add(definition.shortLabel)
  }
  for (const record of state.customs) {
    if (record.id === editingId) continue
    occupiedLabels.add(record.label)
    occupiedShortLabels.add(record.shortLabel)
  }
  if (label && occupiedLabels.has(label)) errors.push({ field: 'label', message: '已存在同名设备' })
  if (shortLabel && occupiedShortLabels.has(shortLabel)) errors.push({ field: 'shortLabel', message: '简称已被其他设备占用' })
  return errors
}

export function snapshotOf(definition: Pick<DeviceDefinition, 'label' | 'shortLabel' | 'color' | 'category'>): DeviceSnapshot {
  return { label: definition.label, shortLabel: definition.shortLabel, color: definition.color, category: definition.category }
}

export function findDefinition(definitions: DeviceDefinition[], type: string): DeviceDefinition | undefined {
  return definitions.find((definition) => definition.type === type)
}

/** 面板按分类分组：保持内置分类顺序，自定义分类按名称首次出现顺序追加 */
export function groupDefinitionsByCategory(definitions: DeviceDefinition[]): Array<{ category: string; devices: DeviceDefinition[] }> {
  const groups = new Map<string, DeviceDefinition[]>()
  for (const category of BUILTIN_CATEGORIES) groups.set(category, [])
  for (const device of definitions) {
    const list = groups.get(device.category)
    if (list) list.push(device)
    else groups.set(device.category, [device])
  }
  return [...groups.entries()]
    .filter(([, devices]) => devices.length > 0)
    .map(([category, devices]) => ({ category, devices }))
}

/** 面板分类筛选项，「全部」之外按内置顺序排列 */
export function listCategories(definitions: DeviceDefinition[]): string[] {
  const ordered = [...BUILTIN_CATEGORIES] as string[]
  for (const device of definitions) {
    if (!ordered.includes(device.category)) ordered.push(device.category)
  }
  return ordered
}
