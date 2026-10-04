import { clampDeskSize, clampItemDimension } from './limits'
import {
  BUILTIN_DEVICE_DEFINITIONS,
  DEFAULT_CATALOG_STATE,
  normalizeCatalogState,
  resolveDefinitions,
  snapshotOf,
  type CatalogState,
  type DeviceDefinition,
  type DeviceSnapshot,
  type DeviceType,
} from './deviceCatalog'

export type { DeviceType, DeviceSnapshot, DeviceDefinition, CatalogState, BuiltinDeviceOverride, CustomDeviceRecord, DeviceInput, DeviceInputError } from './deviceCatalog'
export {
  BUILTIN_DEVICE_DEFINITIONS,
  BUILTIN_CATEGORIES,
  CUSTOM_CATEGORY,
  DEFAULT_CATALOG_STATE,
  findDefinition,
  groupDefinitionsByCategory,
  isBuiltinDeviceType,
  listCategories,
  mergeCatalogStates,
  normalizeCatalogState,
  resolveDefinitions,
  snapshotOf,
  validateDeviceInput,
} from './deviceCatalog'

export type WorkspaceStatus = 'loading' | 'ready' | 'saving' | 'error'

export interface DeskItem {
  id: string
  type: string
  widthMm: number
  heightMm: number
  x: number
  y: number
  rotation: number
  /** 放置时固化的素材信息：名称 / 简称 / 配色 / 分类，老方案缺省时迁移补齐 */
  snapshot: DeviceSnapshot
}

export interface WorkspacePlan {
  id: string
  name: string
  deskWidthMm: number
  deskHeightMm: number
  items: DeskItem[]
  updatedAt: string
}

export const DOCUMENT_VERSION = 2

export interface WorkspaceDocument {
  version: typeof DOCUMENT_VERSION
  plans: WorkspacePlan[]
  activePlanId: string
  /** 随方案一起携带的素材状态（默认尺寸调整、停用、自定义设备） */
  catalog: CatalogState
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

/** 画布 / 检查面板渲染一个已放置设备所需的全部信息 */
export interface ResolvedDevice {
  label: string
  shortLabel: string
  color: string
  category: string
  hint: string
  /** 素材仍在目录中且处于启用状态 */
  available: boolean
  /** 素材已被停用（记录仍可查） */
  retired: boolean
  /** 素材已从目录消失（被删除的自定义设备等），只能依据放置时的快照显示 */
  unknown: boolean
}

const FALLBACK_COLOR = '#9aa9ba'

export function resolvePlacedDevice(item: Pick<DeskItem, 'type' | 'snapshot'>, definitions: DeviceDefinition[]): ResolvedDevice {
  const definition = findDefinitionIn(definitions, item.type)
  const snapshot = item.snapshot
  if (definition) {
    return {
      label: snapshot.label || definition.label,
      shortLabel: snapshot.shortLabel || definition.shortLabel,
      color: snapshot.color || definition.color,
      category: snapshot.category || definition.category,
      hint: definition.hint,
      available: definition.active,
      retired: !definition.active,
      unknown: false,
    }
  }
  return {
    label: snapshot.label || '未知设备',
    shortLabel: snapshot.shortLabel || 'N/A',
    color: snapshot.color || FALLBACK_COLOR,
    category: snapshot.category || '未分类',
    hint: '该素材已不在目录中，设备信息按原方案保留',
    available: false,
    retired: false,
    unknown: true,
  }
}

function findDefinitionIn(definitions: DeviceDefinition[], type: string): DeviceDefinition | undefined {
  return definitions.find((definition) => definition.type === type)
}

export const DEFAULT_DESK = { widthMm: 1600, heightMm: 800 }

export function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}-${crypto.randomUUID()}`
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function createItemFromDefinition(definition: DeviceDefinition, index = 0): DeskItem {
  const columns = 3
  const x = 80 + (index % columns) * 280
  const y = 90 + Math.floor(index / columns) * 240
  return {
    id: createId('item'),
    type: definition.type,
    widthMm: definition.widthMm,
    heightMm: definition.heightMm,
    x,
    y,
    rotation: 0,
    snapshot: snapshotOf(definition),
  }
}

/** @deprecated 仅迁移/测试场景使用，新代码请用 createItemFromDefinition */
export function createItem(type: DeviceType, index = 0): DeskItem {
  const definition = BUILTIN_DEVICE_DEFINITIONS.find((device) => device.type === type) ?? BUILTIN_DEVICE_DEFINITIONS[0]
  const columns = 3
  const x = 80 + (index % columns) * 280
  const y = 90 + Math.floor(index / columns) * 240
  return {
    id: createId('item'),
    type,
    widthMm: definition.widthMm,
    heightMm: definition.heightMm,
    x,
    y,
    rotation: 0,
    snapshot: snapshotOf(definition),
  }
}

export function createPlan(
  name = '我的工作台',
  withDemo = true,
  definitions: DeviceDefinition[] = resolveDefinitions(normalizeCatalogState(undefined)),
): WorkspacePlan {
  const monitor = findDefinitionIn(definitions, 'monitor')
  const keyboard = findDefinitionIn(definitions, 'keyboard')
  const canUseDemo = withDemo && monitor?.active && keyboard?.active
  const items = canUseDemo && monitor && keyboard ? [createItemFromDefinition(monitor, 0), createItemFromDefinition(keyboard, 1)] : []
  if (canUseDemo && items.length === 2) {
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
  const catalog = DEFAULT_CATALOG_STATE
  const plan = createPlan('我的工作台', true, resolveDefinitions(catalog))
  return { version: DOCUMENT_VERSION, plans: [plan], activePlanId: plan.id, catalog }
}

function sanitizeNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function migrateSnapshot(item: Record<string, unknown>): DeviceSnapshot {
  const type = typeof item.type === 'string' ? item.type : ''
  const builtin = BUILTIN_DEVICE_DEFINITIONS.find((device) => device.type === type)
  if (builtin) return snapshotOf(builtin)
  // 老版本只可能引用内置素材；引用不到时给中性快照，绝不用内置第一种顶替
  return { label: '未知设备', shortLabel: 'N/A', color: FALLBACK_COLOR, category: '未分类' }
}

/** 单个方案 / 设备的迁移：补齐快照、清洗尺寸与坐标，保持已放置的几何数据不变 */
function migratePlan(rawPlan: unknown, fallbackIndex: number): WorkspacePlan | null {
  if (!rawPlan || typeof rawPlan !== 'object') return null
  const plan = rawPlan as Record<string, unknown>
  if (!Array.isArray(plan.items)) return null
  const items: DeskItem[] = plan.items.map((rawItem): DeskItem | null => {
    if (!rawItem || typeof rawItem !== 'object') return null
    const item = rawItem as Record<string, unknown>
    if (typeof item.id !== 'string' || typeof item.type !== 'string') return null
    const existingSnapshot = item.snapshot && typeof item.snapshot === 'object' ? item.snapshot as Partial<DeviceSnapshot> : null
    const fallbackSnapshot = migrateSnapshot(item)
    const validColor = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(value.trim())
    const snapshot: DeviceSnapshot = {
      label: typeof existingSnapshot?.label === 'string' && existingSnapshot.label.trim() ? existingSnapshot.label : fallbackSnapshot.label,
      shortLabel: typeof existingSnapshot?.shortLabel === 'string' && existingSnapshot.shortLabel.trim() ? existingSnapshot.shortLabel : fallbackSnapshot.shortLabel,
      color: validColor(existingSnapshot?.color) ? existingSnapshot.color.trim() : fallbackSnapshot.color,
      category: typeof existingSnapshot?.category === 'string' && existingSnapshot.category.trim() ? existingSnapshot.category : fallbackSnapshot.category,
    }
    return {
      id: item.id,
      type: item.type,
      widthMm: clampItemDimension(sanitizeNumber(item.widthMm, 200), 200),
      heightMm: clampItemDimension(sanitizeNumber(item.heightMm, 200), 200),
      x: sanitizeNumber(item.x, 80),
      y: sanitizeNumber(item.y, 90),
      rotation: sanitizeNumber(item.rotation, 0),
      snapshot,
    }
  }).filter((item): item is DeskItem => item !== null)
  const id = typeof plan.id === 'string' ? plan.id : createId('plan')
  return {
    id,
    name: typeof plan.name === 'string' && plan.name.trim() ? plan.name : `工作台 ${fallbackIndex + 1}`,
    deskWidthMm: clampDeskSizeSafe(sanitizeNumber(plan.deskWidthMm, DEFAULT_DESK.widthMm)),
    deskHeightMm: clampDeskSizeSafe(sanitizeNumber(plan.deskHeightMm, DEFAULT_DESK.heightMm)),
    items,
    updatedAt: typeof plan.updatedAt === 'string' ? plan.updatedAt : new Date().toISOString(),
  }
}

function clampDeskSizeSafe(value: number): number {
  return clampDeskSize(value, DEFAULT_DESK.heightMm)
}

/**
 * 迁移持久化文档：
 * - v1（无 catalog、items 无快照）升级到 v2，给已放置设备补打内置素材快照
 * - 已放置设备的宽高 / 坐标 / 旋转原样保留，不被素材默认尺寸反写
 */
export function migrateWorkspaceDocument(value: unknown): WorkspaceDocument | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  if (!Array.isArray(raw.plans) || raw.plans.length === 0) return null
  const catalog = normalizeCatalogState(raw.catalog)
  const plans = raw.plans
    .map((plan, index) => migratePlan(plan, index))
    .filter((plan): plan is WorkspacePlan => plan !== null)
  if (plans.length === 0) return null
  const activePlanId = typeof raw.activePlanId === 'string' && plans.some((plan) => plan.id === raw.activePlanId)
    ? raw.activePlanId
    : plans[0].id
  return { version: DOCUMENT_VERSION, plans, activePlanId, catalog }
}
