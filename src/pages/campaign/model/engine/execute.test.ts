import {describe, expect, it} from 'vitest'

import {executeCommand} from './execute'
import {createStarterState} from './starter'
import type {DiceSource, GameCommand, GameState} from './types'

function dice(...values: number[]): DiceSource {
    return {
        roll: () => {
            const n = values.shift()
            if (!n) throw Error('Лишний бросок')
            return n
        },
    }
}
function ready(): GameState {
    const state = createStarterState()
    state.combat = {
        active: true,
        round: 1,
        order: ['hero', 'goblin'],
        index: 0,
        actionAvailable: true,
    }
    return state
}
const attack: GameCommand = {
    type: 'attack',
    id: 'a1',
    messageId: 'm1',
    expectedRevision: 0,
    actorId: 'hero',
    targetId: 'goblin',
    weaponId: 'sword',
}

describe('executeCommand', () => {
    it('не принимает неизвестный тип и лишние поля команды', () => {
        for (const raw of [
            {...attack, type: 'damage'},
            {...attack, hp: 0},
        ]) {
            expect(executeCommand(ready(), raw as unknown as GameCommand, dice()).kind).toBe(
                'rejected',
            )
        }
    })
    it.each([
        ['попадание', [15, 4], 5],
        ['промах', [2], 12],
        ['критический удар', [20, 4, 5], 0],
        ['natural 1', [1], 12],
    ] as const)('%s', (_, rolls, hp) => {
        const state = ready()
        const result = executeCommand(state, attack, dice(...rolls))
        expect(result.kind).toBe('accepted')
        if (result.kind !== 'accepted') throw Error('Отказ')
        expect(result.nextState.combatants.goblin.hp).toBe(hp)
        expect(result.nextState.combat.actionAvailable).toBe(false)
        expect(result.events.some((e) => e.type === 'attackRoll')).toBe(true)
        expect(state.combatants.goblin.hp).toBe(12)
    })
    it.each(['target', 'range', 'turn', 'resource', 'revision'])(
        'отвергает %s без изменения',
        (reason) => {
            const state = ready()
            const cmd = {...attack}
            if (reason === 'target') cmd.targetId = 'missing'
            if (reason === 'range') state.scene.tokens[1].x = 9
            if (reason === 'turn') state.combat.index = 1
            if (reason === 'resource') state.combat.actionAvailable = false
            if (reason === 'revision') cmd.expectedRevision = 99
            const before = structuredClone(state)
            expect(executeCommand(state, cmd, dice()).kind).toBe('rejected')
            expect(state).toEqual(before)
        },
    )
    it('сначала расходует временные HP', () => {
        const state = ready()
        state.combatants.goblin.tempHp = 3
        const result = executeCommand(state, attack, dice(15, 4))
        if (result.kind !== 'accepted') throw Error('Отказ')
        expect(result.nextState.combatants.goblin.hp).toBe(8)
        expect(result.nextState.combatants.goblin.tempHp).toBe(0)
    })
    it('инициатива и ручной конец хода', () => {
        const start = executeCommand(
            createStarterState(),
            {type: 'start', id: 's', messageId: 's', expectedRevision: 0},
            dice(2, 18),
        )
        if (start.kind !== 'accepted') throw Error('Отказ')
        expect(start.nextState.combat.order).toEqual(['goblin', 'hero'])
        const end = executeCommand(
            start.nextState,
            {type: 'end', id: 'e', messageId: 'e', expectedRevision: 1},
            dice(),
        )
        if (end.kind !== 'accepted') throw Error('Отказ')
        expect(end.nextState.combat.order[end.nextState.combat.index]).toBe('hero')
        expect(end.nextState.combat.actionAvailable).toBe(true)
    })
})
