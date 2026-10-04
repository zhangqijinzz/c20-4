import { useMemo, useState } from 'react'
import { Box, Keyboard, LampDesk, Monitor, Pencil, Plus, RotateCcw, Search, Settings2, Speaker, TabletSmartphone, Trash2, Power } from 'lucide-react'
import type { DeviceDefinition, DeviceInput, DeviceInputError, DeviceType } from '../../../shared/models'
import { groupDefinitionsByCategory, listCategories } from '../../../shared/models'
import { DeviceFormDialog } from './DeviceFormDialog'

interface DevicePaletteProps {
  definitions: DeviceDefinition[]
  usageCounts: Map<string, number>
  onAdd: (type: string) => void
  onSaveDevice: (input: DeviceInput, editingId: string | null) => DeviceInputError[]
  onToggleActive: (type: string, active: boolean) => void
  onReset: (type: DeviceType) => void
  onRemove: (id: string) => void
}

const icons = { monitor: Monitor, keyboard: Keyboard, lamp: LampDesk, speaker: Speaker, stand: TabletSmartphone }

function deviceIcon(device: DeviceDefinition) {
  return icons[device.type as keyof typeof icons] ?? Box
}

function matchesQuery(device: DeviceDefinition, query: string): boolean {
  if (!query) return true
  const keyword = query.trim().toLowerCase()
  return [device.label, device.shortLabel, device.category, device.hint]
    .some((field) => field.toLowerCase().includes(keyword))
}

export function DevicePalette({ definitions, usageCounts, onAdd, onSaveDevice, onToggleActive, onReset, onRemove }: DevicePaletteProps) {
  const [manageMode, setManageMode] = useState(false)
  const [category, setCategory] = useState<string>('全部')
  const [query, setQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<DeviceDefinition | null>(null)
  const [errors, setErrors] = useState<DeviceInputError[]>([])

  const categories = useMemo(() => listCategories(definitions), [definitions])
  const visibleCategories = useMemo(() => {
    const active = definitions.filter((device) => manageMode || device.active)
    const scoped = category === '全部' ? active : active.filter((device) => device.category === category)
    return groupDefinitionsByCategory(scoped.filter((device) => matchesQuery(device, query)))
  }, [category, definitions, manageMode, query])
  const activeCount = definitions.filter((device) => device.active).length

  const openCreate = () => {
    setEditing(null)
    setErrors([])
    setDialogOpen(true)
  }
  const openEdit = (device: DeviceDefinition) => {
    setEditing(device)
    setErrors([])
    setDialogOpen(true)
  }
  const submit = (input: DeviceInput, editingId: string | null) => {
    const nextErrors = onSaveDevice(input, editingId)
    if (nextErrors.length > 0) {
      setErrors(nextErrors)
      return
    }
    setDialogOpen(false)
  }

  return (
    <section className="module-panel palette-panel" aria-labelledby="palette-title">
      <div className="module-heading">
        <div>
          <span className="eyebrow">01 / 素材</span>
          <h2 id="palette-title">设备素材</h2>
        </div>
        <span className="heading-actions">
          <span className="module-count">{activeCount}</span>
          <button className={`icon-action ${manageMode ? 'is-on' : ''}`} aria-label={manageMode ? '退出素材管理' : '管理素材'} title={manageMode ? '完成管理' : '管理素材'} onClick={() => setManageMode((value) => !value)} type="button"><Settings2 size={14} /></button>
        </span>
      </div>
      <p className="panel-description">{manageMode ? '调整内置默认尺寸、停用不用的素材，或新增 / 编辑自定义设备。' : '点击添加到桌面，尺寸可在右侧调整。'}</p>
      <button className="create-device-button" onClick={openCreate} type="button"><Plus size={14} /> 新增自定义设备</button>
      <label className="palette-search">
        <Search size={13} />
        <input value={query} placeholder="搜索名称 / 简称 / 分类" onChange={(event) => setQuery(event.target.value)} />
      </label>
      <div className="category-tabs" role="tablist" aria-label="按分类浏览素材">
        {['全部', ...categories].map((item) => (
          <button key={item} role="tab" aria-selected={category === item} className={`category-tab ${category === item ? 'is-active' : ''}`} onClick={() => setCategory(item)} type="button">{item}</button>
        ))}
      </div>
      <div className="device-list">
        {visibleCategories.map((group) => (
          <div className="device-group" key={group.category}>
            <span className="device-group-label">{group.category}</span>
            {group.devices.map((device) => {
              const Icon = deviceIcon(device)
              const used = usageCounts.get(device.type) ?? 0
              return (
                <div className={`device-card-row ${device.active ? '' : 'is-inactive'}`} key={device.type}>
                  <button className="device-card" disabled={manageMode || !device.active} onClick={() => onAdd(device.type)} type="button">
                    <span className="device-icon" style={{ backgroundColor: device.color }}><Icon size={20} strokeWidth={1.8} /></span>
                    <span className="device-copy"><strong>{device.label}</strong><small>{manageMode ? `${device.widthMm} × ${device.heightMm} mm · ${used} 件在用` : device.hint}</small></span>
                    {!manageMode && <span className="add-mark">+</span>}
                  </button>
                  {manageMode && (
                    <span className="device-manage-actions">
                      <button aria-label={`编辑${device.label}`} title={device.builtin ? '调整默认尺寸' : '编辑设备'} onClick={() => openEdit(device)} type="button"><Pencil size={13} /></button>
                      {device.builtin && (
                        <button aria-label={`恢复${device.label}内置默认`} title="恢复内置默认" onClick={() => onReset(device.type as DeviceType)} type="button"><RotateCcw size={13} /></button>
                      )}
                      {!device.builtin && (
                        <button aria-label={`删除${device.label}`} disabled={used > 0} title={used > 0 ? `已被 ${used} 件设备引用，不能删除` : '删除自定义设备'} className="danger-icon" onClick={() => onRemove(device.type)} type="button"><Trash2 size={13} /></button>
                      )}
                      <button aria-label={device.active ? `停用${device.label}` : `启用${device.label}`} title={device.active ? '停用（已放置设备不受影响）' : '启用'} className={device.active ? '' : 'is-off'} onClick={() => onToggleActive(device.type, !device.active)} type="button"><Power size={13} /></button>
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
        {visibleCategories.length === 0 && <p className="palette-empty">{manageMode ? '没有匹配的素材，试试新增一个自定义设备。' : '当前分类没有可放置的素材，可在右上角管理素材。'}</p>}
      </div>
      {!manageMode && <div className="palette-tip"><span>⌘</span><span>停用或少见的素材仍会按原方案显示，选中即可查看身份</span></div>}
      <DeviceFormDialog open={dialogOpen} editing={editing} categorySuggestions={categories} errors={errors} onClose={() => setDialogOpen(false)} onSubmit={submit} />
    </section>
  )
}
