import {act, renderHook} from '@testing-library/react'
import {afterEach, expect, it, vi} from 'vitest'

import {createCampaignController} from '../model/campaignStore'
import {createStarterState} from '../model/engine/starter'
import {defaultSettings, loadSettings} from '../model/parser/connectionSettings'
import {createLlmParser} from '../model/parser/llmParser'
import {localParser} from '../model/parser/localParser'
import {createRepository} from '../model/repository/indexedDb'
import {useConnectionSettings} from './useConnectionSettings'

afterEach(() => vi.unstubAllGlobals())
it('новый controller после HMR использует действующий ключ из памяти, как настройки', async () => {
    localStorage.clear()
    const repository = createRepository(crypto.randomUUID())
    const state = createStarterState()
    state.combat = {
        active: true,
        round: 1,
        order: ['hero', 'goblin'],
        index: 0,
        actionAvailable: true,
    }
    await repository.create(state)
    const fetched: string[] = []
    vi.stubGlobal('fetch', async (_: unknown, options: RequestInit) => {
        const auth = new Headers(options.headers).get('Authorization') ?? ''
        fetched.push(auth)
        if (auth !== 'Bearer test-key') return new Response('', {status: 401})
        return new Response(
            JSON.stringify({
                choices: [
                    {
                        message: {
                            content: JSON.stringify({
                                kind: 'intent',
                                actorId: 'hero',
                                targetId: 'goblin',
                                weaponId: 'sword',
                            }),
                        },
                    },
                ],
            }),
        )
    })
    const first = createCampaignController({
        repository,
        parser: localParser,
        dice: {roll: () => 15},
    })
    const {result, rerender} = renderHook(({controller}) => useConnectionSettings(controller), {
        initialProps: {controller: first},
    })
    await act(async () => {
        result.current.apply({...defaultSettings, parserMode: 'llm'}, 'test-key')
    })
    expect(loadSettings().apiKey).toBe('')
    const saved = loadSettings()
    const replacement = createCampaignController({
        repository,
        parser: createLlmParser(saved.settings, saved.apiKey),
        dice: {roll: (s) => (s === 20 ? 15 : 4)},
    })
    await replacement.load('demo')
    rerender({controller: replacement})
    await act(async () => {
        await replacement.submitMessage('Атакую гоблина мечом')
    })
    expect(fetched).toEqual(['Bearer test-key'])
    expect(replacement.store.getState().error).toBeNull()
    expect(replacement.store.getState().snapshot?.state.combatants.goblin.hp).toBe(5)
})
