import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { CUSTOM_CATEGORY, type DeviceDefinition, type DeviceInput, type DeviceInputError } from '../../../shared/models'

interface DeviceFormDialogProps {
  open: boolean
  /** 编辑内置素材时只允许调整默认尺寸；null 表示新增自定义设备 */
  editing: DeviceDefinition | null
  categorySuggestions: string[]
  errors: DeviceInputError[]
  onClose: () => void
  onSubmit: (input: DeviceInput, editingId: string | null) => void
}

interface FormState {
  label: string
  shortLabel: string
  color: string
  category: string
  widthMm: string
  heightMm: string
  hint: string
}

const PALETTE_COLORS = ['#93b7ff', '#b5ead7', '#ffd58e', '#f4b7d4', '#cbb7f7', '#9fc1e8', '#ffb59e', '#a8e0cf', '#e4c6f5', '#f2f0a6']

function emptyForm(editing: DeviceDefinition | null): FormState {
  if (editing) {
    return {
      label: editing.label,
      shortLabel: editing.shortLabel,
      color: editing.color,
      category: editing.category,
      widthMm: String(editing.widthMm),
      heightMm: String(editing.heightMm),
      hint: editing.hint,
    }
  }
  return { label: '', shortLabel: '', color: PALETTE_COLORS[5], category: CUSTOM_CATEGORY, widthMm: '200', heightMm: '200', hint: '' }
}

export function DeviceFormDialog({ open, editing, categorySuggestions, errors, onClose, onSubmit }: DeviceFormDialogProps) {
  const [form, setForm] = useState<FormState>(() => emptyForm(editing))

  useEffect(() => {
    if (open) setForm(emptyForm(editing))
  }, [open, editing])

  if (!open) return null
  const builtinEditing = editing?.builtin ?? false
  const errorFor = (field: DeviceInputError['field']) => errors.find((error) => error.field === field)?.message
  const update = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }))

  const submit = () => {
    onSubmit({
      label: form.label,
      shortLabel: form.shortLabel,
      color: form.color,
      category: form.category.trim() || CUSTOM_CATEGORY,
      widthMm: Number(form.widthMm),
      heightMm: Number(form.heightMm),
      hint: form.hint,
    }, editing?.type ?? null)
  }

  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="device-form-title" onPointerDown={onClose}>
      <section className="device-dialog" onPointerDown={(event) => event.stopPropagation()}>
        <header className="device-dialog-header">
          <div><span className="eyebrow">MATERIAL</span><h2 id="device-form-title">{builtinEditing ? `调整「${editing?.label}」默认尺寸` : editing ? `编辑自定义设备「${editing.label}」` : '新增自定义设备'}</h2></div>
          <button className="close-preview" aria-label="关闭" onClick={onClose} type="button"><X size={18} /></button>
        </header>
        {builtinEditing && <p className="dialog-note">内置素材的名称、简称、配色与分类保持内置；这里调整的默认尺寸只影响之后新放置的设备，已经放进方案的设备尺寸不变。</p>}
        <div className="device-form">
          <label className={`form-field ${errorFor('label') ? 'has-error' : ''}`}>
            <span>设备名称</span>
            <input value={form.label} disabled={builtinEditing} maxLength={20} placeholder="例如：手绘板" onChange={(event) => update({ label: event.target.value })} />
            {errorFor('label') && <em className="field-error">{errorFor('label')}</em>}
          </label>
          <label className={`form-field ${errorFor('shortLabel') ? 'has-error' : ''}`}>
            <span>面板简称</span>
            <input value={form.shortLabel} disabled={builtinEditing} maxLength={8} placeholder="例如：TAB" onChange={(event) => update({ shortLabel: event.target.value })} />
            {errorFor('shortLabel') && <em className="field-error">{errorFor('shortLabel')}</em>}
          </label>
          <fieldset className={`form-field form-color-field ${errorFor('color') ? 'has-error' : ''}`} disabled={builtinEditing}>
            <legend>配色</legend>
            <div className="color-row">
              {PALETTE_COLORS.map((color) => (
                <button key={color} type="button" aria-label={`选择配色 ${color}`} className={`color-swatch ${form.color.toLowerCase() === color ? 'is-selected' : ''}`} style={{ backgroundColor: color }} onClick={() => update({ color })} />
              ))}
              <label className="color-custom">
                <input type="color" value={form.color} onChange={(event) => update({ color: event.target.value })} />
                <span>{form.color}</span>
              </label>
            </div>
            {errorFor('color') && <em className="field-error">{errorFor('color')}</em>}
          </fieldset>
          <label className={`form-field ${errorFor('category') ? 'has-error' : ''}`}>
            <span>分类</span>
            <input value={form.category} disabled={builtinEditing} maxLength={12} list="device-category-list" placeholder="例如：数位外设" onChange={(event) => update({ category: event.target.value })} />
            <datalist id="device-category-list">
              {categorySuggestions.map((category) => <option key={category} value={category} />)}
            </datalist>
          </label>
          <label className={`form-field ${errorFor('widthMm') ? 'has-error' : ''}`}>
            <span>默认宽度 (mm)</span>
            <input type="number" min={40} max={2000} value={form.widthMm} onChange={(event) => update({ widthMm: event.target.value })} />
            {errorFor('widthMm') && <em className="field-error">{errorFor('widthMm')}</em>}
          </label>
          <label className={`form-field ${errorFor('heightMm') ? 'has-error' : ''}`}>
            <span>默认深度 (mm)</span>
            <input type="number" min={40} max={2000} value={form.heightMm} onChange={(event) => update({ heightMm: event.target.value })} />
            {errorFor('heightMm') && <em className="field-error">{errorFor('heightMm')}</em>}
          </label>
          {!builtinEditing && (
            <label className="form-field form-field-wide">
              <span>说明（可选）</span>
              <input value={form.hint} maxLength={30} placeholder="面板上显示的小字提示" onChange={(event) => update({ hint: event.target.value })} />
            </label>
          )}
        </div>
        <footer className="device-dialog-footer">
          <button className="dialog-ghost-button" onClick={onClose} type="button">取消</button>
          <button className="dialog-primary-button" onClick={submit} type="button">{editing ? '保存修改' : '添加到素材库'}</button>
        </footer>
      </section>
    </div>
  )
}
