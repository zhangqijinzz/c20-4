// @vitest-environment jsdom
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '../../../app/App'

describe('app render smoke', () => {
  it('mounts the full app and renders palette groups, canvas and inspector', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(React.createElement(App))
      // indexedDB 在 jsdom 中不可用，仓库会回退到 localStorage，等完这条异步链
      await new Promise((resolve) => setTimeout(resolve, 200))
    })
    const text = container.textContent ?? ''
    expect(text).toContain('设备素材')
    expect(text).toContain('显示器')
    expect(text).toContain('新增自定义设备')
    expect(text).toContain('显示设备')
    expect(text).toContain('尺寸检查')
    // 示例方案 2 件设备
    expect(text).toContain('已放置设备')

    // 打开新增弹窗
    const addButton = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('新增自定义设备'))!
    await act(async () => { addButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true })) })
    expect(container.textContent).toContain('设备名称')

    await act(async () => { root.unmount() })
  })
})
