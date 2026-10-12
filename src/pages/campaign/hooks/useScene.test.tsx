import {act, renderHook, waitFor} from '@testing-library/react'
import {expect, it, vi} from 'vitest'

import {createCampaignController} from '../model/campaignStore'
import {createStarterState} from '../model/engine/starter'
import {localParser} from '../model/parser/localParser'
import {createRepository} from '../model/repository/indexedDb'
import {useScene} from './useScene'

vi.mock('../model/scene/pixiRenderer', () => ({
    PixiRenderer: class {
        failed = false
        async mount() {}
        select() {}
        sync() {
            if (this.failed) throw Error('GPU unavailable')
        }
        async play() {
            this.failed = true
            throw Error('frame failed')
        }
        destroy() {}
    },
}))
it('даже ошибка восстановления сцены снимает animation lock, сохраняя игру', async () => {
    const repository = createRepository(crypto.randomUUID())
    await repository.create(createStarterState())
    const c = createCampaignController({repository, parser: localParser, dice: {roll: () => 15}})
    await c.load('demo')
    const ref = {current: document.createElement('div')}
    const {result} = renderHook(() => useScene(ref, c, 'hero', () => {}))
    await act(async () => {
        await Promise.resolve()
    })
    await act(async () => {
        await c.startCombat()
    })
    await waitFor(() => expect(c.store.getState().animation).toBeNull())
    expect(result.current.error).not.toBeNull()
    expect(c.store.getState().snapshot?.state.revision).toBe(1)
    expect((await repository.load('demo'))?.state.revision).toBe(1)
})
