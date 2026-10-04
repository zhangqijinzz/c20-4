export type BuiltinDeviceKind = 'monitor' | 'keyboard' | 'lamp' | 'speaker' | 'stand'
export type DeviceKind = string

export type WorkspaceStatus = 'loading' | 'ready' | 'saving' | 'error'

/** 设备实例自带的外观身份快照，放下后与素材目录解耦，老方案永远能自证身份。 */
export interface ItemIdentity {
  label: string
  shortLabel: string
  color: string
  hint: string
  categoryId: string
}

export interface DeskItem extends ItemIdentity {
  id: string
  type: DeviceKind
  widthMm: number
  heightMm: number
  x: number
  y: number
  rotation: number
}

export interface WorkspacePlan {
  id: string
  name: string
  deskWidthMm: number
  deskHeightMm: number
  items: DeskItem[]
  updatedAt: string
}

export interface WorkspaceDocument {
  version: 2
  plans: WorkspacePlan[]
  activePlanId: string
}

export interface ItemBounds {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

export interface LayoutAnalysis {
  overlapIds: string[]
  outOfBoundsIds: string[]
  coveragePercent: number
  status: 'clear' | 'attention'
}

export interface DeviceCategory {
  id: string
  label: string
  builtin: boolean
}

export interface DeviceDefinition extends ItemIdentity {
  kind: DeviceKind
  widthMm: number
  heightMm: number
  builtin: boolean
  disabled: boolean
}

export const BUILTIN_DEVICE_CATEGORIES: DeviceCategory[] = [
  { id: 'display', label: '显示器', builtin: true },
  { id: 'input', label: '输入设备', builtin: true },
  { id: 'lighting', label: '灯光照明', builtin: true },
  { id: 'audio', label: '音频设备', builtin: true },
  { id: 'accessory', label: '支架配件', builtin: true },
]

export const BUILTIN_DEVICE_DEFINITIONS: DeviceDefinition[] = [
  { kind: 'monitor', label: '显示器', shortLabel: 'MON', widthMm: 540, heightMm: 210, color: '#93b7ff', hint: '主屏 / 副屏', categoryId: 'display', builtin: true, disabled: false },
  { kind: 'keyboard', label: '键盘', shortLabel: 'KEY', widthMm: 440, heightMm: 150, color: '#b5ead7', hint: '全尺寸 / 75%', categoryId: 'input', builtin: true, disabled: false },
  { kind: 'lamp', label: '桌面灯', shortLabel: 'LAMP', widthMm: 180, heightMm: 180, color: '#ffd58e', hint: '灯座占用', categoryId: 'lighting', builtin: true, disabled: false },
  { kind: 'speaker', label: '音箱', shortLabel: 'SPK', widthMm: 150, heightMm: 150, color: '#f4b7d4', hint: '左右声道', categoryId: 'audio', builtin: true, disabled: false },
  { kind: 'stand', label: '支架', shortLabel: 'STAND', widthMm: 260, heightMm: 180, color: '#cbb7f7', hint: '支架 / 坞站', categoryId: 'accessory', builtin: true, disabled: false },
]

/** 素材缺失（停用不删数据，但自定义素材可能被删除）时的兜底外观。 */
export const FALLBACK_COLOR = '#c6cfdb'

export const DEFAULT_DESK = { widthMm: 1600, heightMm: 800 }

export function findBuiltinDefinition(kind: DeviceKind): DeviceDefinition | undefined {
  return BUILTIN_DEVICE_DEFINITIONS.find((device) => device.kind === kind)
}

export function fallbackDefinition(kind: DeviceKind): DeviceDefinition {
  return {
    kind,
    label: '未知设备',
    shortLabel: kind ? kind.slice(0, 4).toUpperCase() : '?',
    widthMm: 200,
    heightMm: 200,
    color: FALLBACK_COLOR,
    hint: '素材库中找不到该设备的资料',
    categoryId: 'unknown',
    builtin: false,
    disabled: false,
  }
}

/** 从设备实例上取身份快照；旧数据缺字段时用内置资料补齐，保证任何方案都画得出来。 */
export function getItemIdentity(item: Partial<DeskItem> & Pick<DeskItem, 'type'>): ItemIdentity {
  const fallback = findBuiltinDefinition(item.type) ?? fallbackDefinition(item.type)
  return {
    label: item.label || fallback.label,
    shortLabel: item.shortLabel || fallback.shortLabel,
    color: item.color || fallback.color,
    hint: item.hint ?? fallback.hint,
    categoryId: item.categoryId || fallback.categoryId,
  }
}

export function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}-${crypto.randomUUID()}`
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function createItem(source: DeviceDefinition | DeviceKind, index = 0): DeskItem {
  const definition = typeof source === 'string'
    ? (findBuiltinDefinition(source) ?? fallbackDefinition(source))
    : source
  const columns = 3
  const x = 80 + (index % columns) * 280
  const y = 90 + Math.floor(index / columns) * 240
  return {
    id: createId('item'),
    type: definition.kind,
    label: definition.label,
    shortLabel: definition.shortLabel,
    color: definition.color,
    hint: definition.hint,
    categoryId: definition.categoryId,
    widthMm: definition.widthMm,
    heightMm: definition.heightMm,
    x,
    y,
    rotation: 0,
  }
}

export function createPlan(name = '我的工作台', withDemo = true): WorkspacePlan {
  const items = withDemo ? [createItem('monitor', 0), createItem('keyboard', 1)] : []
  if (withDemo) {
    items[0].x = 530
    items[0].y = 105
    items[1].x = 580
    items[1].y = 470
  }
  return {
    id: createId('plan'),
    name,
    deskWidthMm: DEFAULT_DESK.widthMm,
    deskHeightMm: DEFAULT_DESK.heightMm,
    items,
    updatedAt: new Date().toISOString(),
  }
}

export function createInitialDocument(): WorkspaceDocument {
  const plan = createPlan('我的工作台', true)
  return { version: 2, plans: [plan], activePlanId: plan.id }
}
