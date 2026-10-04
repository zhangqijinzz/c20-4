import { useMemo, useState } from 'react'
import { Box, Keyboard, LampDesk, Monitor, Settings2, Speaker, TabletSmartphone } from 'lucide-react'
import type { DeviceDefinition } from '../../../shared/models'
import type { PaletteGroup } from '../materialsViewModel'

interface DevicePaletteProps {
  groups: PaletteGroup[]
  onAdd: (device: DeviceDefinition) => void
  onManage: () => void
}

const icons: Record<string, typeof Monitor> = {
  monitor: Monitor,
  keyboard: Keyboard,
  lamp: LampDesk,
  speaker: Speaker,
  stand: TabletSmartphone,
}

export function DevicePalette({ groups, onAdd, onManage }: DevicePaletteProps) {
  const total = useMemo(() => groups.reduce((sum, group) => sum + group.devices.length, 0), [groups])
  const [activeCategory, setActiveCategory] = useState<string>('all')

  const visibleGroups = activeCategory === 'all'
    ? groups
    : groups.filter((group) => group.category.id === activeCategory)
  const visibleCount = visibleGroups.reduce((sum, group) => sum + group.devices.length, 0)

  return (
    <section className="module-panel palette-panel" aria-labelledby="palette-title">
      <div className="module-heading">
        <div>
          <span className="eyebrow">01 / 素材</span>
          <h2 id="palette-title">设备素材</h2>
        </div>
        <span className="module-count">{total}</span>
      </div>
      <p className="panel-description">点击添加到桌面，尺寸可在右侧调整。</p>
      <div className="palette-filters" role="tablist" aria-label="按分类筛选素材">
        <button
          type="button"
          className={`palette-filter ${activeCategory === 'all' ? 'is-active' : ''}`}
          onClick={() => setActiveCategory('all')}
        >
          全部
        </button>
        {groups.map((group) => (
          <button
            type="button"
            key={group.category.id}
            className={`palette-filter ${activeCategory === group.category.id ? 'is-active' : ''}`}
            onClick={() => setActiveCategory(group.category.id)}
          >
            {group.category.label}
          </button>
        ))}
      </div>
      <div className="device-list">
        {visibleGroups.flatMap((group) =>
          group.devices.map((device) => {
            const Icon = icons[device.kind] ?? Box
            return (
              <button className="device-card" key={device.kind} onClick={() => onAdd(device)} type="button">
                <span className="device-icon" style={{ backgroundColor: device.color }}><Icon size={20} strokeWidth={1.8} /></span>
                <span className="device-copy"><strong>{device.label}</strong><small>{device.widthMm} × {device.heightMm} mm · {group.category.label}</small></span>
                <span className="add-mark">+</span>
              </button>
            )
          }),
        )}
        {visibleCount === 0 && <p className="palette-empty">该分类下暂无可添加的素材，可在管理中启用或新增。</p>}
      </div>
      <button className="manage-materials-button" onClick={onManage} type="button">
        <Settings2 size={14} /> 管理素材库
      </button>
      <div className="palette-tip"><span>⌘</span><span>可先放置，再用尺寸检查微调</span></div>
    </section>
  )
}
