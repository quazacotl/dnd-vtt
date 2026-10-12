import {describe, expect, it} from 'vitest'

import {createStarterState} from '../engine/starter'
import type {CommittedAction} from '../repository/types'
import {createAnimationQueue} from './animationQueue'

describe('Animation queue', () => {
    it('проигрывает действия последовательно и отменяет ожидающие', async () => {
        const played: string[] = []
        let release: () => void = () => {}
        const renderer = {
            play: async (a: CommittedAction) => {
                played.push(a.command.id)
                await new Promise<void>((r) => {
                    release = r
                })
            },
        }
        const queue = createAnimationQueue(renderer)
        const state = createStarterState()
        const a: CommittedAction = {
            command: {type: 'start', id: 'a', messageId: 'a', expectedRevision: 0},
            beforeState: state,
            result: {kind: 'accepted', nextState: state, events: []},
            text: '',
        }
        const first = queue.enqueue(a)
        await Promise.resolve()
        const second = queue.enqueue({...a, command: {...a.command, id: 'b'}})
        queue.cancel()
        release()
        await first
        await second
        expect(played).toEqual(['a'])
        expect(state.revision).toBe(0)
    })
})
