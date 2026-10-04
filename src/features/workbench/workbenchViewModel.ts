import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createId,
  createInitialDocument,
  createPlan,
  DEFAULT_CATALOG_STATE,
  findDefinition,
  resolveDefinitions,
  type CatalogState,
  type DeviceInput,
  type DeskItem,
  type DeviceType,
  type LayoutAnalysis,
  type WorkspaceDocument,
  type WorkspacePlan,
  type WorkspaceStatus,
} from '../../shared/models'
import { clampDeskSize, clampItemDimension } from '../../shared/layoutRules'
import { moveCanvasItem, rotateCanvasItem } from '../canvas/canvasViewModel'
import {
  countDeviceUsage,
  createMaterialDraft,
  deleteCustomDevice,
  resetBuiltin,
  setBuiltinDimensions,
  setDeviceActive,
  upsertCustomDevice,
  validateDeviceInput,
  type DeviceInputError,
} from '../materials/materialsViewModel'
import { inspectPlan } from '../inspection/inspectionViewModel'
import { LocalWorkspaceRepository, type WorkspaceRepository } from './workspaceRepository'

export interface WorkspaceViewModel {
  status: WorkspaceStatus
  document: WorkspaceDocument | null
  activePlan: WorkspacePlan | null
  selectedItem: DeskItem | null
  analysis: LayoutAnalysis
  issueIds: string[]
  issueCount: number
  feedback: string
  isPreviewOpen: boolean
  catalog: CatalogState
  selectItem: (id: string | null) => void
  addItem: (type: string) => void
  removeItem: (id: string) => void
  moveItem: (id: string, x: number, y: number) => void
  rotateItem: (id: string, delta: number) => void
  updateItem: (id: string, patch: Partial<Pick<DeskItem, 'widthMm' | 'heightMm' | 'x' | 'y'>>) => void
  updateDesk: (field: 'deskWidthMm' | 'deskHeightMm', value: number) => void
  createNewPlan: () => void
  duplicatePlan: () => void
  selectPlan: (id: string) => void
  deleteCurrentPlan: () => void
  openPreview: () => void
  closePreview: () => void
  saveDevice: (input: DeviceInput, editingId: string | null) => DeviceInputError[]
  toggleDeviceActive: (type: string, active: boolean) => void
  resetDevice: (type: DeviceType) => void
  removeDevice: (id: string) => void
}

const emptyInspection = { analysis: { overlapIds: [], outOfBoundsIds: [], coveragePercent: 0, status: 'clear' as const }, issueIds: [], issueCount: 0 }

export function useWorkspaceViewModel(repository?: WorkspaceRepository): WorkspaceViewModel {
  const repositoryRef = useRef(repository ?? new LocalWorkspaceRepository())
  const [status, setStatus] = useState<WorkspaceStatus>('loading')
  const [document, setDocument] = useState<WorkspaceDocument | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [feedback, setFeedback] = useState('正在准备你的工作台…')

  useEffect(() => {
    let active = true
    void repositoryRef.current.load().then((loaded) => {
      if (!active) return
      const nextDocument = loaded ?? createInitialDocument()
      setDocument(nextDocument)
      setStatus('ready')
      setFeedback(loaded ? '已恢复上次编辑状态' : '已创建示例工作台，可以直接拖动设备')
    }).catch(() => {
      if (!active) return
      setDocument(createInitialDocument())
      setStatus('error')
      setFeedback('本地数据读取失败，当前使用临时工作台')
    })
    return () => { active = false }
  }, [])

  const catalog: CatalogState = useMemo(() => document?.catalog ?? DEFAULT_CATALOG_STATE, [document])
  const definitions = useMemo(() => resolveDefinitions(catalog), [catalog])

  const activePlan = useMemo(
    () => document?.plans.find((plan) => plan.id === document.activePlanId) ?? null,
    [document],
  )
  const selectedItem = activePlan?.items.find((item) => item.id === selectedItemId) ?? null
  const inspection = useMemo(() => activePlan ? inspectPlan(activePlan) : emptyInspection, [activePlan])
  const { analysis, issueIds, issueCount } = inspection

  const persist = useCallback(async (nextDocument: WorkspaceDocument, message: string) => {
    setDocument(nextDocument)
    setStatus('saving')
    setFeedback(message)
    try {
      await repositoryRef.current.save(nextDocument)
      setStatus('ready')
    } catch {
      setStatus('error')
      setFeedback('自动保存失败，请检查浏览器本地存储权限')
    }
  }, [])

  const updateActivePlan = useCallback((updater: (plan: WorkspacePlan) => WorkspacePlan, message: string) => {
    if (!document || !activePlan) return
    const nextPlan = { ...updater(activePlan), updatedAt: new Date().toISOString() }
    const nextDocument = { ...document, plans: document.plans.map((plan) => plan.id === nextPlan.id ? nextPlan : plan) }
    void persist(nextDocument, message)
  }, [activePlan, document, persist])

  const updateCatalog = useCallback((nextCatalog: CatalogState, message: string) => {
    if (!document) return
    void persist({ ...document, catalog: nextCatalog }, message)
  }, [document, persist])

  const selectItem = useCallback((id: string | null) => setSelectedItemId(id), [])

  const addItem = useCallback((type: string) => {
    if (!activePlan) return
    const definition = findDefinition(definitions, type)
    if (!definition || !definition.active) {
      setFeedback('该素材已停用，可在素材管理中重新启用')
      return
    }
    const draft = createMaterialDraft(definition, activePlan.items.length)
    updateActivePlan((plan) => ({ ...plan, items: [...plan.items, draft.item] }), draft.feedback)
    setSelectedItemId(draft.item.id)
  }, [activePlan, definitions, updateActivePlan])

  const removeItem = useCallback((id: string) => {
    updateActivePlan((plan) => ({ ...plan, items: plan.items.filter((item) => item.id !== id) }), '设备已移除')
    setSelectedItemId((current) => current === id ? null : current)
  }, [updateActivePlan])

  const moveItem = useCallback((id: string, x: number, y: number) => {
    updateActivePlan((plan) => ({ ...plan, items: moveCanvasItem(plan.items, id, x, y) }), '位置已更新')
  }, [updateActivePlan])

  const rotateItem = useCallback((id: string, delta: number) => {
    updateActivePlan((plan) => ({ ...plan, items: rotateCanvasItem(plan.items, id, delta) }), '角度已更新')
  }, [updateActivePlan])

  const updateItem = useCallback((id: string, patch: Partial<Pick<DeskItem, 'widthMm' | 'heightMm' | 'x' | 'y'>>) => {
    updateActivePlan((plan) => ({
      ...plan,
      items: plan.items.map((item) => item.id === id ? {
        ...item,
        ...patch,
        widthMm: patch.widthMm === undefined ? item.widthMm : clampItemDimension(patch.widthMm, item.widthMm),
        heightMm: patch.heightMm === undefined ? item.heightMm : clampItemDimension(patch.heightMm, item.heightMm),
      } : item),
    }), '尺寸参数已更新')
  }, [updateActivePlan])

  const updateDesk = useCallback((field: 'deskWidthMm' | 'deskHeightMm', value: number) => {
    if (!activePlan) return
    updateActivePlan((plan) => ({ ...plan, [field]: clampDeskSize(value, plan[field]) }), '桌面尺寸已更新')
  }, [activePlan, updateActivePlan])

  const createNewPlan = useCallback(() => {
    if (!document) return
    const plan = createPlan(`工作台 ${document.plans.length + 1}`, false, definitions)
    void persist({ ...document, plans: [...document.plans, plan], activePlanId: plan.id }, '已创建空白方案')
    setSelectedItemId(null)
  }, [definitions, document, persist])

  const duplicatePlan = useCallback(() => {
    if (!document || !activePlan) return
    const copy: WorkspacePlan = {
      ...activePlan,
      id: createId('plan'),
      name: `${activePlan.name} · 副本`,
      items: activePlan.items.map((item) => ({ ...item, id: createId('item') })),
      updatedAt: new Date().toISOString(),
    }
    void persist({ ...document, plans: [...document.plans, copy], activePlanId: copy.id }, '方案已复制')
    setSelectedItemId(null)
  }, [activePlan, document, persist])

  const selectPlan = useCallback((id: string) => {
    if (!document || !document.plans.some((plan) => plan.id === id)) return
    void persist({ ...document, activePlanId: id }, '已切换方案')
    setSelectedItemId(null)
  }, [document, persist])

  const deleteCurrentPlan = useCallback(() => {
    if (!document || !activePlan || document.plans.length <= 1) {
      setFeedback('至少保留一个工作台方案')
      return
    }
    const remaining = document.plans.filter((plan) => plan.id !== activePlan.id)
    void persist({ ...document, plans: remaining, activePlanId: remaining[0].id }, '方案已删除')
    setSelectedItemId(null)
  }, [activePlan, document, persist])

  const openPreview = useCallback(() => setIsPreviewOpen(true), [])
  const closePreview = useCallback(() => setIsPreviewOpen(false), [])

  const saveDevice = useCallback((input: DeviceInput, editingId: string | null): DeviceInputError[] => {
    if (!document) return []
    const errors = validateDeviceInput(input, catalog, editingId)
    if (errors.length > 0) return errors
    if (editingId) {
      const isBuiltinEditing = definitions.some((device) => device.type === editingId && device.builtin)
      if (isBuiltinEditing) {
        // 内置素材只放开默认尺寸：名称/配色/分类仍由内置定义决定
        updateCatalog(
          setBuiltinDimensions(catalog, editingId as DeviceType, input.widthMm, input.heightMm),
          `「${input.label}」默认尺寸已更新，已有设备不受影响`,
        )
      } else {
        updateCatalog(upsertCustomDevice(catalog, input, editingId), `「${input.label}」已保存`)
      }
    } else {
      updateCatalog(upsertCustomDevice(catalog, input, null), `已新增自定义设备「${input.label}」`)
    }
    return []
  }, [catalog, definitions, document, updateCatalog])

  const toggleDeviceActive = useCallback((type: string, active: boolean) => {
    if (!document) return
    const definition = findDefinition(definitions, type)
    if (!definition) return
    updateCatalog(
      setDeviceActive(catalog, type, active),
      active ? `「${definition.label}」已启用` : `「${definition.label}」已停用，方案中的设备仍会显示`,
    )
  }, [catalog, definitions, document, updateCatalog])

  const resetDevice = useCallback((type: DeviceType) => {
    if (!document) return
    const definition = findDefinition(definitions, type)
    if (!definition) return
    updateCatalog(resetBuiltin(catalog, type), `「${definition.label}」已恢复内置默认`)
  }, [catalog, definitions, document, updateCatalog])

  const removeDevice = useCallback((id: string) => {
    if (!document) return
    const definition = findDefinition(definitions, id)
    if (!definition || definition.builtin) {
      setFeedback('内置素材不能删除，可选择停用')
      return
    }
    const usage = countDeviceUsage(document.plans).get(id) ?? 0
    if (usage > 0) {
      setFeedback(`「${definition.label}」已被 ${usage} 件已放置设备引用，不能删除，可改为停用`)
      return
    }
    updateCatalog(deleteCustomDevice(catalog, id), `「${definition.label}」已删除`)
  }, [catalog, definitions, document, updateCatalog])

  return {
    status,
    document,
    activePlan,
    selectedItem,
    analysis,
    issueIds,
    issueCount,
    feedback,
    isPreviewOpen,
    catalog,
    selectItem,
    addItem,
    removeItem,
    moveItem,
    rotateItem,
    updateItem,
    updateDesk,
    createNewPlan,
    duplicatePlan,
    selectPlan,
    deleteCurrentPlan,
    openPreview,
    closePreview,
    saveDevice,
    toggleDeviceActive,
    resetDevice,
    removeDevice,
  }
}
