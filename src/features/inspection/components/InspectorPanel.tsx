import { AlertTriangle, Crosshair, RotateCcw, RotateCw, Ruler, Trash2 } from 'lucide-react'
import type { DeviceDefinition, DeskItem, WorkspacePlan } from '../../../shared/models'
import { resolvePlacedDevice } from '../../../shared/models'

interface InspectorPanelProps {
  plan: WorkspacePlan
  definitions: DeviceDefinition[]
  item: DeskItem | null
  issueIds: string[]
  onUpdateDesk: (field: 'deskWidthMm' | 'deskHeightMm', value: number) => void
  onUpdateItem: (id: string, patch: Partial<Pick<DeskItem, 'widthMm' | 'heightMm' | 'x' | 'y'>>) => void
  onRotate: (id: string, delta: number) => void
  onDelete: (id: string) => void
}

function NumericField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="numeric-field"><span>{label}</span><input type="number" value={value} min={40} onChange={(event) => onChange(event.currentTarget.valueAsNumber)} /><em>mm</em></label>
}

export function InspectorPanel({ plan, definitions, item, issueIds, onUpdateDesk, onUpdateItem, onRotate, onDelete }: InspectorPanelProps) {
  const isIssue = item ? issueIds.includes(item.id) : false
  const device = item ? resolvePlacedDevice(item, definitions) : null
  return (
    <aside className="inspector-panel">
      <div className="module-heading">
        <div><span className="eyebrow">02 / 检查</span><h2>尺寸检查</h2></div>
        <Ruler size={18} className="muted-icon" />
      </div>
      <div className="desk-size-card">
        <div className="field-heading"><span>桌面画布</span><span className="field-status">实时</span></div>
        <div className="desk-size-fields">
          <NumericField label="宽度" value={plan.deskWidthMm} onChange={(value) => onUpdateDesk('deskWidthMm', value)} />
          <NumericField label="深度" value={plan.deskHeightMm} onChange={(value) => onUpdateDesk('deskHeightMm', value)} />
        </div>
        <p className="helper-text">建议保留 40 mm 走线缓冲空间</p>
      </div>
      {item && device ? (
        <div className="item-editor">
          <div className="selected-item-heading"><span className="selected-swatch" style={{ backgroundColor: device.color }} /> <div><strong>{device.label}</strong><small>{device.category}{device.unknown ? ` · 素材标识 ${item.type}` : ''}</small></div><span className="item-code">{device.shortLabel}</span></div>
          {device.unknown && <div className="notice-callout"><AlertTriangle size={16} /><span>{device.hint}，名称与配色按原方案快照保留，可继续调整尺寸与位置。</span></div>}
          {device.retired && <div className="notice-callout muted-notice"><AlertTriangle size={16} /><span>该素材已在面板停用，但本方案中的设备保持原样，编辑与统计不受影响。</span></div>}
          {isIssue && <div className="issue-callout"><AlertTriangle size={16} /><span>设备与其他元素重叠或超出桌面边界</span></div>}
          <div className="field-heading"><span>实际尺寸</span><span className="unit-label">单位：毫米</span></div>
          <div className="two-column-fields">
            <NumericField label="宽度" value={item.widthMm} onChange={(value) => onUpdateItem(item.id, { widthMm: value })} />
            <NumericField label="深度" value={item.heightMm} onChange={(value) => onUpdateItem(item.id, { heightMm: value })} />
          </div>
          <div className="field-heading position-heading"><span>位置</span><span className="unit-label">左上角坐标</span></div>
          <div className="two-column-fields">
            <NumericField label="X" value={Math.round(item.x)} onChange={(value) => onUpdateItem(item.id, { x: value })} />
            <NumericField label="Y" value={Math.round(item.y)} onChange={(value) => onUpdateItem(item.id, { y: value })} />
          </div>
          <div className="rotation-row"><span><Crosshair size={15} /> 旋转角度 <strong>{Math.round(item.rotation)}°</strong></span><div className="rotation-actions"><button aria-label="逆时针旋转 15 度" onClick={() => onRotate(item.id, -15)} type="button"><RotateCcw size={15} /></button><button aria-label="顺时针旋转 15 度" onClick={() => onRotate(item.id, 15)} type="button"><RotateCw size={15} /></button></div></div>
          <button className="remove-item-button" onClick={() => onDelete(item.id)} type="button"><Trash2 size={15} /> 移除这个设备</button>
        </div>
      ) : (
        <div className="empty-inspector"><span className="empty-illustration">⌖</span><strong>选择一个设备</strong><p>点击画布上的设备查看尺寸、位置和旋转控制。</p></div>
      )}
    </aside>
  )
}
