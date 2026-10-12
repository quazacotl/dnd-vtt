import {describe, expect, it} from 'vitest'

import {createCampaignController} from './campaignStore'
import {createStarterState} from './engine/starter'
import {localParser} from './parser/localParser'
import {createRepository} from './repository/indexedDb'

async function setup() {
    const repository = createRepository(crypto.randomUUID())
    const s = createStarterState()
    s.scene.obstacles = [{x: 4, y: 3}]
    s.scene.tokens[0].x = 2
    s.scene.tokens[0].y = 3
    s.scene.tokens[1].x = 7
    s.scene.tokens[1].y = 3
    s.combat = {
        active: true,
        round: 1,
        order: ['hero', 'goblin'],
        index: 0,
        actionAvailable: true,
        movementRemaining: 30,
    }
    await repository.create(s)
    let rolls = 0
    const values = [15, 4]
    const c = createCampaignController({
        repository,
        parser: localParser,
        dice: {
            roll: () => {
                rolls++
                return values.shift()!
            },
        },
    })
    await c.load('demo')
    return {c, repository, getRolls: () => rolls}
}
describe('сквозное движение', () => {
    it('чат → подход/атака → reload → replay без новых бросков', async () => {
        const {c, getRolls} = await setup()
        await c.submitMessage('Подхожу к гоблину и атакую мечом')
        expect(c.store.getState().snapshot?.state.combatants.goblin.hp).toBe(5)
        expect(c.store.getState().snapshot?.state.combat.movementRemaining).toBe(10)
        const id = c.store.getState().animation!.command.id
        const before = structuredClone(c.store.getState().snapshot)
        c.finishAnimation()
        await c.load('demo')
        expect(c.store.getState().snapshot).toEqual(before)
        await c.replay(id)
        expect(c.store.getState().animation?.result.events[0].type).toBe('movement')
        expect(c.store.getState().snapshot).toEqual(before)
        expect(getRolls()).toBe(2)
    })
    it('клик использует тот же движок и запись', async () => {
        const {c, getRolls} = await setup()
        await c.moveTo({x: 3, y: 3}, 'hero')
        expect(c.store.getState().snapshot?.state.scene.tokens[0].x).toBe(3)
        expect(c.store.getState().snapshot?.state.combat.movementRemaining).toBe(25)
        expect(getRolls()).toBe(0)
    })
})
