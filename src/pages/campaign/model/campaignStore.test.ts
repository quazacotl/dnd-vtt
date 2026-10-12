import {describe, expect, it} from 'vitest'

import {createCampaignController} from './campaignStore'
import {createStarterState} from './engine/starter'
import {localParser} from './parser/localParser'
import type {IntentParser} from './parser/types'
import {createRepository} from './repository/indexedDb'

async function controller(parser: IntentParser = localParser) {
    const repository = createRepository(crypto.randomUUID())
    const state = createStarterState()
    state.combat = {
        active: true,
        round: 1,
        order: ['hero', 'goblin'],
        index: 0,
        actionAvailable: true,
        movementRemaining: 30,
    }
    await repository.create(state)
    const values = [15, 4]
    let count = 0
    const c = createCampaignController({
        repository,
        parser,
        dice: {
            roll: () => {
                count++
                return values.shift()!
            },
        },
    })
    await c.load('demo')
    return {c, repository, getCount: () => count}
}
describe('Campaign controller', () => {
    it('восстанавливает исходный текст сообщения после перезагрузки', async () => {
        const {c} = await controller()
        await c.submitMessage('Атакую гоблина мечом')
        const commandId = c.store.getState().animation!.command.id
        c.finishAnimation()
        await c.load('demo')
        expect(c.store.getState().texts[commandId]).toBe('Атакую гоблина мечом')
    })
    it('отмена parser не разблокирует уже начавшуюся запись', async () => {
        const {c, repository} = await controller()
        const commit = repository.commit.bind(repository)
        let release: () => void = () => {}
        repository.commit = async (a) => {
            await new Promise<void>((r) => {
                release = r
            })
            return commit(a)
        }
        const pending = c.submitMessage('Атакую гоблина мечом')
        await new Promise((r) => setTimeout(r, 0))
        c.cancelRequest()
        expect(c.store.getState().busy).toBe(true)
        release()
        await pending
    })
    it('публикует только сохранённую атаку и предоставляет replay', async () => {
        const {c, repository} = await controller()
        await c.submitMessage('Атакую гоблина мечом')
        expect(c.store.getState().snapshot?.state.combatants.goblin.hp).toBe(5)
        expect((await repository.load('demo'))?.state.combatants.goblin.hp).toBe(5)
        expect(c.store.getState().animation?.beforeState.combatants.goblin.hp).toBe(12)
        const revision = c.store.getState().snapshot?.state.revision
        c.finishAnimation()
        await c.replay(c.store.getState().snapshot!.events[0].commandId)
        expect(c.store.getState().snapshot?.state.revision).toBe(revision)
    })
    it('ошибка записи сохраняет старые HP, retry не бросает кости снова', async () => {
        const {c, repository, getCount} = await controller()
        const commit = repository.commit.bind(repository)
        let fail = true
        repository.commit = async (a) => {
            if (fail) throw Error('Нет записи')
            return commit(a)
        }
        await c.submitMessage('Атакую гоблина мечом')
        expect(c.store.getState().snapshot?.state.combatants.goblin.hp).toBe(12)
        expect(c.store.getState().pendingSave).not.toBeNull()
        fail = false
        await c.retrySave()
        expect(c.store.getState().snapshot?.state.combatants.goblin.hp).toBe(5)
        expect(getCount()).toBe(2)
    })
    it('двойная отправка и поздний ответ после отмены не применяются', async () => {
        let resolve: (value: Awaited<ReturnType<IntentParser['parse']>>) => void = () => {}
        const parser: IntentParser = {
            parse: () =>
                new Promise((r) => {
                    resolve = r
                }),
        }
        const {c, getCount} = await controller(parser)
        const first = c.submitMessage('Атакую')
        await c.submitMessage('Атакую')
        c.cancelRequest()
        resolve({kind: 'intent', actorId: 'hero', targetId: 'goblin', weaponId: 'sword'})
        await first
        expect(c.store.getState().snapshot?.state.combatants.goblin.hp).toBe(12)
        expect(getCount()).toBe(0)
    })
    it('новый parser отменяет запрос старого', async () => {
        let resolve: (value: Awaited<ReturnType<IntentParser['parse']>>) => void = () => {}
        const {c} = await controller({
            parse: () =>
                new Promise((r) => {
                    resolve = r
                }),
        })
        const pending = c.submitMessage('Атакую')
        c.setParser(localParser)
        resolve({kind: 'intent', actorId: 'hero', targetId: 'goblin', weaponId: 'sword'})
        await pending
        expect(c.store.getState().snapshot?.state.revision).toBe(0)
    })
})
