import { act } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import React from 'react'
import { createRoot } from 'react-dom/client'
import {
  DEFAULT_CATALOG_STATE,
  resolveDefinitions,
  resolvePlacedDevice,
  type DeviceInput,
  type WorkspaceDocument,
} from '../../../shared/models'
import type { WorkspaceRepository } from '../workspaceRepository'
import { useWorkspaceViewModel, type WorkspaceViewModel } from '../workbenchViewModel'

function harness() {
  let saved: WorkspaceDocument | null = null
  const repository: WorkspaceRepository = {
    load: async () => saved,
    save: async (document) => {
      saved = document
    },
  }
  let current: WorkspaceViewModel | null = null
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  function HookProbe() {
    current = useWorkspaceViewModel(repository)
    return null
  }
  /** 在 act 内执行交互，并等完 persist 链路里的全部微任务（setDocument -> await save -> setStatus） */
  const run = async (interaction?: () => unknown) => {
    await act(async () => {
      interaction?.()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }
  const render = () => run(() => { root.render(React.createElement(HookProbe)) })
  const unmount = () => run(() => { root.unmount() })
  const vm = () => {
    if (!current) throw new Error('view model not ready')
    return current
  }
  return { render, run, unmount, vm, saved: () => saved }
}

const roots: Array<() => Promise<void>> = []
afterEach(async () => {
  while (roots.length) await roots.pop()!()
})

const tabletInput: DeviceInput = {
  label: '手绘板',
  shortLabel: 'TAB',
  color: '#a8e0cf',
  category: '数位外设',
  widthMm: 260,
  heightMm: 200,
  hint: '中号',
}

describe('workspace view model material lifecycle', () => {
  it('creates custom materials, places snapshot copies, and shields placed items from later default edits', async () => {
    const h = harness()
    roots.push(h.unmount)
    await h.render()
    expect(h.vm().document).not.toBeNull()

    // 新增自定义设备
    let errors: ReturnType<WorkspaceViewModel['saveDevice']> = []
    await h.run(() => { errors = h.vm().saveDevice(tabletInput, null) })
    expect(errors).toEqual([])
    const tablet = h.vm().document!.catalog.customs[0]
    expect(tablet.label).toBe('手绘板')

    // 放置到画布，尺寸取当时的默认值，且带快照
    await h.run(() => h.vm().addItem(tablet.id))
    const placed = h.vm().activePlan!.items.find((item) => item.type === tablet.id)!
    expect(placed.widthMm).toBe(260)
    expect(placed.snapshot.label).toBe('手绘板')

    // 回头改素材默认尺寸：已放置设备不变，新放置的设备取新默认值
    await h.run(() => { errors = h.vm().saveDevice({ ...tabletInput, widthMm: 320, heightMm: 240 }, tablet.id) })
    expect(errors).toEqual([])
    await h.run(() => h.vm().addItem(tablet.id))
    const items = h.vm().activePlan!.items.filter((item) => item.type === tablet.id)
    expect(items[0].widthMm).toBe(260)
    expect(items[1].widthMm).toBe(320)
  })

  it('keeps retired and removed materials visible, editable and counted in old plans', async () => {
    const h = harness()
    roots.push(h.unmount)
    await h.render()

    await h.run(() => h.vm().saveDevice(tabletInput, null))
    const tabletId = h.vm().document!.catalog.customs[0].id
    await h.run(() => h.vm().addItem(tabletId))
    const placedId = h.vm().activePlan!.items.find((item) => item.type === tabletId)!.id

    // 停用：面板不可再添加，但已放置设备可继续编辑
    await h.run(() => h.vm().toggleDeviceActive(tabletId, false))
    let placed = h.vm().activePlan!.items.find((item) => item.id === placedId)!
    expect(resolvePlacedDevice(placed, resolveDefinitions(h.vm().catalog)).retired).toBe(true)
    expect(resolvePlacedDevice(placed, resolveDefinitions(h.vm().catalog)).label).toBe('手绘板')
    await h.run(() => h.vm().updateItem(placedId, { widthMm: 400 }))
    placed = h.vm().activePlan!.items.find((item) => item.id === placedId)!
    expect(placed.widthMm).toBe(400)
    expect(h.vm().activePlan!.items.length).toBe(3) // 示例 2 件 + 手绘板 1 件

    // 停用状态下不能再添加
    await h.run(() => h.vm().addItem(tabletId))
    expect(h.vm().activePlan!.items.filter((item) => item.type === tabletId).length).toBe(1)

    // 有方案引用时删除被拦截
    await h.run(() => h.vm().removeDevice(tabletId))
    expect(h.vm().document!.catalog.customs).toHaveLength(1)

    // 素材从目录消失（模拟外部删除）：仍按放置时的快照显示
    const orphanItem = h.saved()!.plans[0].items.find((item) => item.type === tabletId)!
    const resolved = resolvePlacedDevice(orphanItem, resolveDefinitions(DEFAULT_CATALOG_STATE))
    expect(resolved.unknown).toBe(true)
    expect(resolved.label).toBe('手绘板')
    expect(resolved.color).toBe('#a8e0cf')

    // 内置设备停用 -> 恢复默认
    await h.run(() => h.vm().toggleDeviceActive('speaker', false))
    expect(resolveDefinitions(h.vm().catalog).find((device) => device.type === 'speaker')?.active).toBe(false)
    await h.run(() => h.vm().resetDevice('speaker'))
    const speaker = resolveDefinitions(h.vm().catalog).find((device) => device.type === 'speaker')!
    expect(speaker.active).toBe(true)
    expect(speaker.widthMm).toBe(150)
  })

  it('refuses invalid device input', async () => {
    const h = harness()
    roots.push(h.unmount)
    await h.render()
    let errors: ReturnType<WorkspaceViewModel['saveDevice']> = []
    await h.run(() => { errors = h.vm().saveDevice({ ...tabletInput, label: '', widthMm: 10 }, null) })
    expect(errors.map((error) => error.field)).toEqual(expect.arrayContaining(['label', 'widthMm']))
    expect(h.vm().document!.catalog.customs).toHaveLength(0)
  })
})
