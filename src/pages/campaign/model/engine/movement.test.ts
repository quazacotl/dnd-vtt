import {describe, expect, it} from 'vitest'

import {executeCommand} from './execute'
import {findPath, reachableCells} from './movement'
import {createStarterState} from './starter'
import type {GameCommand, GameState} from './types'

function ready(): GameState {
    const s = createStarterState()
    s.scene.obstacles = []
    s.scene.tokens[0] = {id: 'hero-token', combatantId: 'hero', x: 2, y: 3}
    s.scene.tokens[1] = {id: 'goblin-token', combatantId: 'goblin', x: 7, y: 3}
    s.combat = {
        active: true,
        round: 1,
        order: ['hero', 'goblin'],
        index: 0,
        actionAvailable: true,
        movementRemaining: 30,
    }
    return s
}
const base = {id: 'move-1', messageId: 'message-1', expectedRevision: 0}
const dice = {
    roll: () => {
        throw Error('Движение не должно бросать кости')
    },
}
describe('движение', () => {
    it('обходит препятствие, не срезает закрытый угол', () => {
        const s = ready()
        s.scene.obstacles = [
            {x: 3, y: 3},
            {x: 3, y: 2},
        ]
        const path = findPath(s, 'hero', {x: 4, y: 3})!
        expect(path).not.toContainEqual({x: 3, y: 3})
        expect(path.length).toBe(5)
        expect(path[0]).toEqual({x: 2, y: 3})
        expect(path.at(-1)).toEqual({x: 4, y: 3})
    })
    it('не проходит через занятые клетки и границы', () => {
        const s = ready()
        expect(findPath(s, 'hero', {x: 7, y: 3})).toBeNull()
        expect(findPath(s, 'hero', {x: -1, y: 3})).toBeNull()
        expect(findPath(s, 'hero', {x: 12, y: 3})).toBeNull()
        s.scene.obstacles = [
            {x: 1, y: 3},
            {x: 2, y: 2},
            {x: 3, y: 3},
            {x: 2, y: 4},
        ]
        expect(findPath(s, 'hero', {x: 4, y: 3})).toBeNull()
    })
    it('движение расходует скорость и сохраняет путь, но не действие', () => {
        const result = executeCommand(
            ready(),
            {...base, type: 'move', actorId: 'hero', destination: {x: 4, y: 3}},
            dice,
        )
        if (result.kind !== 'accepted') throw Error('Отказ')
        expect(result.nextState.scene.tokens[0].x).toBe(4)
        expect(result.nextState.combat.movementRemaining).toBe(20)
        expect(result.nextState.combat.actionAvailable).toBe(true)
        expect(result.events[0]).toMatchObject({
            type: 'movement',
            costFeet: 10,
            path: [
                {x: 2, y: 3},
                {x: 3, y: 3},
                {x: 4, y: 3},
            ],
        })
    })
    it('движение больше бюджета отклоняется без изменений', () => {
        const s = ready()
        s.combat.movementRemaining = 5
        const before = structuredClone(s)
        expect(
            executeCommand(
                s,
                {...base, type: 'move', actorId: 'hero', destination: {x: 4, y: 3}},
                dice,
            ).kind,
        ).toBe('rejected')
        expect(s).toEqual(before)
        expect(reachableCells(s, 'hero')).not.toContainEqual({x: 4, y: 3})
    })
    it('в начале следующего хода восстанавливается скорость участника', () => {
        const s = ready()
        s.combat.movementRemaining = 0
        s.combatants.goblin.speed = 20
        const r = executeCommand(s, {...base, type: 'end'}, dice)
        if (r.kind !== 'accepted') throw Error('Отказ')
        expect(r.nextState.combat.movementRemaining).toBe(20)
    })
})
describe('подход и атака', () => {
    const command = {
        ...base,
        type: 'approachAttack',
        actorId: 'hero',
        targetId: 'goblin',
        weaponId: 'sword',
    } as GameCommand
    it('сначала подходит и затем атакует, одной ревизией', () => {
        const s = ready()
        s.scene.obstacles = [{x: 4, y: 3}]
        const values = [15, 4]
        const result = executeCommand(s, command, {roll: () => values.shift()!})
        if (result.kind !== 'accepted') throw Error('Отказ')
        expect(result.events.map((e) => e.type)).toEqual(['movement', 'attackRoll', 'damage'])
        expect(result.nextState.combatants.goblin.hp).toBe(5)
        expect(result.nextState.combat.actionAvailable).toBe(false)
        expect(result.nextState.revision).toBe(1)
        expect(result.nextState.combat.movementRemaining).toBe(10)
    })
    it.each(['resource', 'distance', 'weapon', 'target'])(
        'при невозможном %s не двигается и не бросает кости',
        (reason) => {
            const s = ready()
            const c = {...command}
            if (reason === 'resource') s.combat.actionAvailable = false
            if (reason === 'distance') s.combat.movementRemaining = 5
            if (reason === 'weapon' && c.type === 'approachAttack') c.weaponId = 'missing'
            if (reason === 'target' && c.type === 'approachAttack') c.targetId = 'missing'
            const before = structuredClone(s)
            expect(executeCommand(s, c, dice).kind).toBe('rejected')
            expect(s).toEqual(before)
        },
    )
})
