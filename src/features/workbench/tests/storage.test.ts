import { describe, expect, it } from 'vitest'
import { LocalWorkspaceRepository } from '../workspaceRepository'
import type { StorageService } from '../storageService'
import { createInitialDocument } from '../../../shared/models'

function memoryStorage(initial: string | null = null): StorageService {
  let value = initial
  return { read: async () => value, write: async (next) => { value = next } }
}

describe('local workspace repository', () => {
  it('round trips a document', async () => {
    const repository = new LocalWorkspaceRepository(memoryStorage())
    const document = createInitialDocument()
    await repository.save(document)
    const loaded = await repository.load()
    expect(loaded?.document).toEqual(document)
    expect(loaded?.migrated).toBe(false)
  })

  it('falls back when stored JSON is damaged', async () => {
    const repository = new LocalWorkspaceRepository(memoryStorage('{broken'))
    await expect(repository.load()).resolves.toBeNull()
  })

  it('migrates a stored v1 document and reports it', async () => {
    const v1 = JSON.stringify({
      version: 1,
      activePlanId: 'p1',
      plans: [{
        id: 'p1', name: '老方案', deskWidthMm: 1600, deskHeightMm: 800, updatedAt: '',
        items: [{ id: 'i1', type: 'lamp', widthMm: 180, heightMm: 180, x: 0, y: 0, rotation: 0 }],
      }],
    })
    const repository = new LocalWorkspaceRepository(memoryStorage(v1))
    const loaded = await repository.load()
    expect(loaded?.migrated).toBe(true)
    expect(loaded?.document.version).toBe(2)
    expect(loaded?.document.plans[0].items[0].label).toBe('桌面灯')
  })
})
