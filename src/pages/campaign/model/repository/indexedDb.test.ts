import {describe, expect, it} from 'vitest'

import {executeCommand} from '../engine/execute'
import {createStarterState} from '../engine/starter'
import {createRepository} from './indexedDb'
import type {CommittedAction} from './types'

function action(): CommittedAction {
    const state = createStarterState()
    state.combat = {
        active: true,
        round: 1,
        order: ['hero', 'goblin'],
        index: 0,
        actionAvailable: true,
        movementRemaining: 30,
    }
    const command = {
        type: 'attack' as const,
        id: 'a',
        messageId: 'm',
        expectedRevision: 0,
        actorId: 'hero',
        targetId: 'goblin',
        weaponId: 'sword',
    }
    const rolls = [15, 4]
    const result = executeCommand(state, command, {roll: () => rolls.shift()!})
    if (result.kind !== 'accepted') throw Error('Отказ')
    return {command, beforeState: state, result, text: 'Атакую гоблина мечом'}
}
describe('IndexedDB', () => {
    it('старое сохранение получает скорость и карту без потери HP и ревизии', async () => {
        const name = crypto.randomUUID()
        const repo = createRepository(name)
        const s = createStarterState()
        await repo.create(s)
        const legacy = {
            version: 1,
            state: {
                ...s,
                revision: 7,
                scene: {...s.scene, obstacles: undefined},
                combat: {...s.combat, movementRemaining: undefined},
                combatants: Object.fromEntries(
                    Object.entries(s.combatants).map(([id, c]) => [
                        id,
                        {...c, hp: id === 'goblin' ? 7 : c.hp, speed: undefined},
                    ]),
                ),
            },
            events: [],
        }
        const db = await new Promise<IDBDatabase>((resolve) => {
            const req = indexedDB.open(name)
            req.onsuccess = () => resolve(req.result)
        })
        await new Promise<void>((resolve) => {
            const tx = db.transaction('campaigns', 'readwrite')
            tx.objectStore('campaigns').put(legacy)
            tx.oncomplete = () => resolve()
        })
        const snapshot = await repo.load('demo')
        expect(snapshot?.state.combatants.goblin.hp).toBe(7)
        expect(snapshot?.state.revision).toBe(7)
        expect(snapshot?.state.combatants.hero.speed).toBe(30)
        expect(snapshot?.state.combat.movementRemaining).toBe(30)
        expect(snapshot?.state.scene.obstacles).toContainEqual({x: 2, y: 3})
        db.close()
    })
    it.each([99, 1])('повреждённое сохранение версии %s не удаляется', async (version) => {
        const name = crypto.randomUUID()
        const repo = createRepository(name)
        await repo.create(createStarterState())
        const db = await new Promise<IDBDatabase>((resolve) => {
            const req = indexedDB.open(name)
            req.onsuccess = () => resolve(req.result)
        })
        const broken = {version, state: {id: 'demo'}, events: []}
        await new Promise<void>((resolve) => {
            const tx = db.transaction('campaigns', 'readwrite')
            tx.objectStore('campaigns').put(broken)
            tx.oncomplete = () => resolve()
        })
        await expect(repo.load('demo')).rejects.toThrow('Сохранение повреждено')
        const stored = await new Promise<unknown>((resolve) => {
            const req = db.transaction('campaigns').objectStore('campaigns').get('demo')
            req.onsuccess = () => resolve(req.result)
        })
        expect(stored).toEqual(broken)
        db.close()
    })
    it('не проигрывает повреждённую запись действия', async () => {
        const name = crypto.randomUUID()
        const repo = createRepository(name)
        await repo.create(createStarterState())
        const db = await new Promise<IDBDatabase>((resolve) => {
            const req = indexedDB.open(name)
            req.onsuccess = () => resolve(req.result)
        })
        await new Promise<void>((resolve) => {
            const tx = db.transaction('actions', 'readwrite')
            tx.objectStore('actions').put({command: {id: 'bad'}, result: {}})
            tx.oncomplete = () => resolve()
        })
        await expect(repo.getAction('bad')).rejects.toThrow('История действия повреждена')
        db.close()
    })
    it('недоступный IndexedDB не заменяется памятью', async () => {
        const original = globalThis.indexedDB
        Object.defineProperty(globalThis, 'indexedDB', {
            value: undefined,
            configurable: true,
            writable: true,
        })
        try {
            await expect(createRepository(crypto.randomUUID()).load('demo')).rejects.toThrow(
                'IndexedDB недоступен',
            )
        } finally {
            Object.defineProperty(globalThis, 'indexedDB', {
                value: original,
                configurable: true,
                writable: true,
            })
        }
    })
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
        const a = action()
        await repo.create(a.beforeState)
        a.command.expectedRevision = 99
        await expect(repo.commit(a)).rejects.toThrow('Состояние изменилось')
        expect((await repo.load('demo'))?.state.combatants.goblin.hp).toBe(12)
        expect(await repo.getAction('a')).toBeNull()
    })
    it('не заменяет существующую кампанию при создании', async () => {
        const repo = createRepository(crypto.randomUUID())
        const a = action()
        await repo.create(a.beforeState)
        await repo.commit(a)
        await expect(repo.create(a.beforeState)).rejects.toThrow('Кампания уже существует')
        expect((await repo.load('demo'))?.state.combatants.goblin.hp).toBe(5)
    })
})
