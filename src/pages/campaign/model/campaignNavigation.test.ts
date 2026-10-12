import {expect, it} from 'vitest'

import {createCampaignController} from './campaignStore'
import {createStarterState} from './engine/starter'
import {newCampaign} from './management'
import {localParser} from './parser/localParser'
import {createRepository} from './repository/indexedDb'

it('поздний commit не заменяет уже открытую другую кампанию', async () => {
    const repo = createRepository(crypto.randomUUID())
    const first = createStarterState()
    first.combat = {
        active: true,
        round: 1,
        order: ['hero', 'goblin'],
        index: 0,
        actionAvailable: true,
        movementRemaining: 30,
    }
    await repo.create(first)
    const second = await repo.create(newCampaign('Другая', 8, 8), 'Другая')
    const commit = repo.commit.bind(repo)
    let release: () => void = () => {}
    repo.commit = async (action) => {
        await new Promise<void>((r) => {
            release = r
        })
        return commit(action)
    }
    const c = createCampaignController({
        repository: repo,
        parser: localParser,
        dice: {roll: (s) => (s === 20 ? 15 : 4)},
    })
    await c.load(first.id)
    const pending = c.submitMessage('Атакую гоблина мечом')
    await new Promise((r) => setTimeout(r, 0))
    await c.load(second.state.id)
    release()
    await pending
    expect(c.store.getState().snapshot?.state.id).toBe(second.state.id)
    expect(c.store.getState().animation).toBeNull()
    expect((await repo.load(first.id))?.state.combatants.goblin.hp).toBe(5)
})
