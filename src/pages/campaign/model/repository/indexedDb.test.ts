import {describe, expect, it} from 'vitest'
import {createRepository} from './indexedDb'
import {createStarterState} from '../engine/starter'
import {executeCommand} from '../engine/execute'
import type {CommittedAction} from './types'

function action(): CommittedAction {
    const state = createStarterState()
    state.combat = {active: true, round: 1, order: ['hero', 'goblin'], index: 0, actionAvailable: true}
    const command = {type: 'attack' as const, id: 'a', messageId: 'm', expectedRevision: 0, actorId: 'hero', targetId: 'goblin', weaponId: 'sword'}
    const rolls = [15, 4]
    const result = executeCommand(state, command, {roll: () => rolls.shift()!})
    if (result.kind !== 'accepted') throw Error('Отказ')
    return {command, beforeState: state, result, text: 'Атакую гоблина мечом'}
}
describe('IndexedDB', () => {
    it('сохраняет состояние, события и дедуплицирует команду', async () => {
        const repo = createRepository(crypto.randomUUID())
        const a = action()
        await repo.create(a.beforeState)
        const once = await repo.commit(a)
        const twice = await repo.commit(a)
        expect(once.state.combatants.goblin.hp).toBe(5)
        expect(twice.events.length).toBe(once.events.length)
        expect((await repo.load('demo'))?.state.combatants.goblin.hp).toBe(5)
        expect((await repo.getAction('a'))?.beforeState.combatants.goblin.hp).toBe(12)
    })
    it('конфликт revision не записывает частичный результат', async () => {
        const repo = createRepository(crypto.randomUUID())
        const a = action(); await repo.create(a.beforeState)
        a.command.expectedRevision = 99
        await expect(repo.commit(a)).rejects.toThrow()
        expect((await repo.load('demo'))?.state.combatants.goblin.hp).toBe(12)
        expect(await repo.getAction('a')).toBeNull()
    })
    it('не заменяет существующую кампанию при создании', async () => {
        const repo = createRepository(crypto.randomUUID()); const a = action()
        await repo.create(a.beforeState); await repo.commit(a)
        await expect(repo.create(a.beforeState)).rejects.toThrow()
        expect((await repo.load('demo'))?.state.combatants.goblin.hp).toBe(5)
    })
})
