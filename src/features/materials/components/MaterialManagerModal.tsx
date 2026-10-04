import { useMemo, useState } from 'react'
import { Box, Keyboard, LampDesk, Monitor, Plus, Speaker, TabletSmartphone, Trash2, X } from 'lucide-react'
import type { DeviceCategory, DeviceDefinition } from '../../../shared/models'
import { clampItemDimension } from '../../../shared/layoutRules'
import type { DeviceInput } from '../materialCatalog'

interface MaterialManagerModalProps {
  categories: DeviceCategory[]
  devices: DeviceDefinition[]
  onClose: () => void
  onCreate: (input: DeviceInput) => void
  onUpdateCustom: (kind: string, patch: Partial<DeviceInput>) => void
  onDeleteCustom: (kind: string) => void
  onSetBuiltin: (kind: string, patch: { widthMm?: number; heightMm?: number; disabled?: boolean }) => void
  onAddCategory: (label: string) => DeviceCategory
}

const COLOR_SWATCHES = ['#93b7ff', '#b5ead7', '#ffd58e', '#f4b7d4', '#cbb7f7', '#ffb09c', '#9fd8e8', '#a8d5a2']

const icons: Record<string, typeof Monitor> = {
  monitor: Monitor,
  keyboard: Keyboard,
  lamp: LampDesk,
  speaker: Speaker,
  stand: TabletSmartphone,
}

function parseDimension(value: number, fallback: number): number {
  return Number.isFinite(value) ? clampItemDimension(value, fallback) : fallback
}

export function MaterialManagerModal({
  categories,
  devices,
  onClose,
  onCreate,
  onUpdateCustom,
  onDeleteCustom,
  onSetBuiltin,
  onAddCategory,
}: MaterialManagerModalProps) {
  const [name, setName] = useState('')
  const [shortLabel, setShortLabel] = useState('')
  const [width, setWidth] = useState(200)
  const [height, setHeight] = useState(200)
  const [color, setColor] = useState(COLOR_SWATCHES[0])
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? 'accessory')
  const [newCategory, setNewCategory] = useState('')
  const [error, setError] = useState('')

  const grouped = useMemo(() => {
    const map = new Map(categories.map((category) => [category.id, category]))
    return devices.map((device) => ({
      device,
      category: map.get(device.categoryId)?.label ?? '其他',
    }))
  }, [categories, devices])

  const submitNew = () => {
    if (!name.trim()) {
      setError('请先填写设备名称')
      return
    }
    let targetCategory = categoryId
    if (newCategory.trim()) {
      targetCategory = onAddCategory(newCategory.trim()).id
    }
    onCreate({
      label: name.trim(),
      shortLabel: shortLabel.trim() || undefined,
      widthMm: parseDimension(width, 200),
      heightMm: parseDimension(height, 200),
      color,
      categoryId: targetCategory,
    })
    setName('')
    setShortLabel('')
    setWidth(200)
    setHeight(200)
    setNewCategory('')
    setError('')
  }

  return (
    <div className="preview-backdrop" role="dialog" aria-modal="true" aria-labelledby="material-manager-title" onPointerDown={onClose}>
      <section className="preview-modal material-modal" onPointerDown={(event) => event.stopPropagation()}>
        <header className="preview-modal-header">
          <div>
            <span className="eyebrow">MATERIAL LIBRARY</span>
            <h2 id="material-manager-title">素材库管理</h2>
            <p>新增自定义设备，调整内置设备的默认尺寸或停用；已放在方案里的设备不受影响。</p>
          </div>
          <button className="close-preview" aria-label="关闭素材管理" onClick={onClose} type="button"><X size={18} /></button>
        </header>

        <div className="material-body">
          <div className="material-create-card">
            <div className="material-section-title"><Plus size={14} /> 新增自定义设备</div>
            <div className="material-form">
              <label className="material-field material-field-wide">
                <span>名称</span>
                <input value={name} onChange={(event) => setName(event.currentTarget.value)} placeholder="例如：洞洞板 / 手绘板" maxLength={16} />
              </label>
              <label className="material-field">
                <span>简称（画布显示，留空自动生成）</span>
                <input value={shortLabel} onChange={(event) => setShortLabel(event.currentTarget.value)} maxLength={6} placeholder="AUTO" />
              </label>
              <label className="material-field">
                <span>默认宽度 mm</span>
                <input type="number" min={40} max={2000} value={width} onChange={(event) => setWidth(event.currentTarget.valueAsNumber)} />
              </label>
              <label className="material-field">
                <span>默认深度 mm</span>
                <input type="number" min={40} max={2000} value={height} onChange={(event) => setHeight(event.currentTarget.valueAsNumber)} />
              </label>
              <div className="material-field">
                <span>配色</span>
                <div className="color-picker-row">
                  {COLOR_SWATCHES.map((swatch) => (
                    <button
                      type="button"
                      key={swatch}
                      className={`color-swatch ${color === swatch ? 'is-selected' : ''}`}
                      style={{ backgroundColor: swatch }}
                      aria-label={`选择配色 ${swatch}`}
                      onClick={() => setColor(swatch)}
                    />
                  ))}
                  <input type="color" value={color} onChange={(event) => setColor(event.currentTarget.value)} aria-label="自定义颜色" />
                </div>
              </div>
              <label className="material-field">
                <span>分类</span>
                <select value={categoryId} onChange={(event) => setCategoryId(event.currentTarget.value)}>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
                </select>
              </label>
              <label className="material-field">
                <span>没有合适的分类？输入新分类名</span>
                <input value={newCategory} onChange={(event) => setNewCategory(event.currentTarget.value)} placeholder="例如：收纳" maxLength={8} />
              </label>
            </div>
            {error && <p className="material-error">{error}</p>}
            <button className="material-create-button" onClick={submitNew} type="button"><Plus size={15} /> 添加到素材库</button>
          </div>

          <div className="material-section-title">素材清单（{devices.length}）</div>
          <div className="material-table">
            {grouped.map(({ device, category }) => {
              const Icon = icons[device.kind] ?? Box
              return (
                <div className={`material-row ${device.disabled ? 'is-disabled' : ''}`} key={device.kind}>
                  <span className="device-icon" style={{ backgroundColor: device.color }}><Icon size={18} strokeWidth={1.8} /></span>
                  {device.builtin ? (
                    <>
                      <span className="material-row-name">
                        <strong>{device.label}</strong>
                        <small>内置 · {category}</small>
                      </span>
                      <label className="material-dim"><span>宽</span><input type="number" min={40} max={2000} value={device.widthMm} onChange={(event) => onSetBuiltin(device.kind, { widthMm: parseDimension(event.currentTarget.valueAsNumber, device.widthMm) })} /></label>
                      <label className="material-dim"><span>深</span><input type="number" min={40} max={2000} value={device.heightMm} onChange={(event) => onSetBuiltin(device.kind, { heightMm: parseDimension(event.currentTarget.valueAsNumber, device.heightMm) })} /></label>
                      <button
                        type="button"
                        className={`disable-toggle ${device.disabled ? 'is-off' : ''}`}
                        onClick={() => onSetBuiltin(device.kind, { disabled: !device.disabled })}
                        aria-pressed={!device.disabled}
                      >
                        {device.disabled ? '已停用' : '使用中'}
                      </button>
                    </>
                  ) : (
                    <>
                      <input className="material-name-input" aria-label="设备名称" value={device.label} onChange={(event) => onUpdateCustom(device.kind, { label: event.currentTarget.value })} maxLength={16} />
                      <input className="material-short-input" aria-label="设备简称" value={device.shortLabel} onChange={(event) => onUpdateCustom(device.kind, { shortLabel: event.currentTarget.value })} maxLength={6} />
                      <label className="material-dim"><span>宽</span><input type="number" min={40} max={2000} value={device.widthMm} onChange={(event) => onUpdateCustom(device.kind, { widthMm: parseDimension(event.currentTarget.valueAsNumber, device.widthMm) })} /></label>
                      <label className="material-dim"><span>深</span><input type="number" min={40} max={2000} value={device.heightMm} onChange={(event) => onUpdateCustom(device.kind, { heightMm: parseDimension(event.currentTarget.valueAsNumber, device.heightMm) })} /></label>
                      <input className="material-color-input" type="color" aria-label="设备配色" value={device.color} onChange={(event) => onUpdateCustom(device.kind, { color: event.currentTarget.value })} />
                      <select className="material-category-select" aria-label="设备分类" value={device.categoryId} onChange={(event) => onUpdateCustom(device.kind, { categoryId: event.currentTarget.value })}>
                        {categories.map((categoryOption) => <option key={categoryOption.id} value={categoryOption.id}>{categoryOption.label}</option>)}
                      </select>
                      <button type="button" className="material-delete" aria-label={`删除自定义设备 ${device.label}`} onClick={() => onDeleteCustom(device.kind)}><Trash2 size={15} /></button>
                    </>
                  )}
                </div>
              )
            })}
          </div>
          <p className="material-note">停用只是从素材面板隐藏；方案中已放置的同名设备仍会照常显示、可编辑、计入统计。删除自定义设备也不会清除已放置的实例。</p>
        </div>
      </section>
    </div>
  )
}
