import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_CATALOG,
  addCustomCategory as addCategory,
  addCustomDevice as addDevice,
  getDefinition,
  groupDevicesByCategory,
  removeCustomDevice as removeDevice,
  resolveCatalog,
  setBuiltinOverride,
  updateCustomDevice as updateDevice,
  type BuiltinDeviceOverride,
  type DeviceInput,
  type MaterialCatalog,
} from './materialCatalog'
import type { DeviceDefinition, DeviceKind, DeviceCategory } from '../../shared/models'
import { createItem, type DeskItem } from '../../shared/models'
import { BrowserStorageService, type StorageService } from '../workbench/storageService'

export const MATERIALS_STORAGE_KEY = 'focusdesk.materials.v1'

export interface MaterialDraft {
  item: DeskItem
  feedback: string
}

/** 添加实例时按当前目录快照落盘；目录以后再变，与这个实例无关。 */
export function createMaterialDraft(definition: DeviceDefinition, currentItemCount: number): MaterialDraft {
  return {
    item: createItem(definition, currentItemCount),
    feedback: `${definition.label}已添加`,
  }
}

export interface MaterialCatalogRepository {
  load(): Promise<MaterialCatalog | null>
  save(catalog: MaterialCatalog): Promise<void>
}

export class LocalMaterialCatalogRepository implements MaterialCatalogRepository {
  constructor(private readonly storage: StorageService = new BrowserStorageService(MATERIALS_STORAGE_KEY)) {}

  async load(): Promise<MaterialCatalog | null> {
    try {
      const raw = await this.storage.read()
      if (!raw) return null
      return sanitizeCatalog(JSON.parse(raw))
    } catch {
      return null
    }
  }

  async save(catalog: MaterialCatalog): Promise<void> {
    await this.storage.write(JSON.stringify(catalog))
  }
}

function sanitizeCatalog(value: unknown): MaterialCatalog | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<MaterialCatalog>
  return {
    version: 1,
    customDevices: Array.isArray(candidate.customDevices) ? candidate.customDevices as DeviceDefinition[] : [],
    customCategories: Array.isArray(candidate.customCategories) ? candidate.customCategories as DeviceCategory[] : [],
    builtinOverrides: candidate.builtinOverrides && typeof candidate.builtinOverrides === 'object'
      ? candidate.builtinOverrides as Record<string, BuiltinDeviceOverride>
      : {},
  }
}

export interface PaletteGroup {
  category: DeviceCategory
  devices: DeviceDefinition[]
}

export interface MaterialCatalogApi {
  catalog: MaterialCatalog
  ready: boolean
  groups: PaletteGroup[]
  addDevice: (input: DeviceInput) => DeviceDefinition
  updateDevice: (kind: DeviceKind, patch: Partial<DeviceInput>) => void
  deleteDevice: (kind: DeviceKind) => void
  setBuiltin: (kind: DeviceKind, patch: BuiltinDeviceOverride) => void
  addCategory: (label: string) => DeviceCategory
  resolve: (kind: DeviceKind) => DeviceDefinition
}

export function useMaterialCatalog(repository?: MaterialCatalogRepository): MaterialCatalogApi {
  const repositoryRef = useRef(repository ?? new LocalMaterialCatalogRepository())
  const [catalog, setCatalog] = useState<MaterialCatalog>(DEFAULT_CATALOG)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    void repositoryRef.current.load().then((loaded) => {
      if (!active) return
      if (loaded) setCatalog(loaded)
      setReady(true)
    }).catch(() => active && setReady(true))
    return () => { active = false }
  }, [])

  const persist = useCallback((next: MaterialCatalog) => {
    setCatalog(next)
    void repositoryRef.current.save(next).catch(() => undefined)
  }, [])

  const groups = useMemo(() => {
    const { devices, categories } = resolveCatalog(catalog)
    return groupDevicesByCategory(devices, categories)
  }, [catalog])

  const addCustomDevice = useCallback((input: DeviceInput) => {
    const result = addDevice(catalog, input)
    persist(result.catalog)
    return result.device
  }, [catalog, persist])

  const updateCustomDevice = useCallback((kind: DeviceKind, patch: Partial<DeviceInput>) => {
    persist(updateDevice(catalog, kind, patch))
  }, [catalog, persist])

  const deleteCustomDevice = useCallback((kind: DeviceKind) => {
    persist(removeDevice(catalog, kind))
  }, [catalog, persist])

  const updateBuiltin = useCallback((kind: DeviceKind, patch: BuiltinDeviceOverride) => {
    persist(setBuiltinOverride(catalog, kind, patch))
  }, [catalog, persist])

  const createCategory = useCallback((label: string) => {
    const result = addCategory(catalog, label)
    if (result.catalog !== catalog) persist(result.catalog)
    return result.category
  }, [catalog, persist])

  const resolve = useCallback((kind: DeviceKind) => getDefinition(catalog, kind), [catalog])

  return {
    catalog,
    ready,
    groups,
    addDevice: addCustomDevice,
    updateDevice: updateCustomDevice,
    deleteDevice: deleteCustomDevice,
    setBuiltin: updateBuiltin,
    addCategory: createCategory,
    resolve,
  }
}
