import {expect, it} from 'vitest'

import {newCampaign, newParticipant, editParticipant} from './management'
import {createRepository} from './repository/indexedDb'
import {exportCharacter, importCharacter, exportScene, importScene} from './transfer'

it('участник переносится со всеми характеристиками и новыми ID', () => {
    const actor = newParticipant('character', 'Маг')
    actor.details!.spells = [{name: 'Свет', level: 0, description: 'Справочная запись'}]
    actor.details!.inventory = [{name: 'Посох', count: 1}]
    const copy = importCharacter(exportCharacter(actor))
    expect(copy.id).not.toBe(actor.id)
    expect(copy.weapons[0].id).not.toBe(actor.weapons[0].id)
    expect(copy.details).toEqual(actor.details)
    expect(() => importCharacter('{"format":"other"}')).toThrow('Повреждённый JSON')
})
it('сцена импортируется как независимая копия; недопустимые клетки и бой блокируют редактор', async () => {
    const repo = createRepository(crypto.randomUUID())
    const original = await repo.create(newCampaign('Карта', 8, 8), 'Карта')
    const hero = newParticipant('character', 'Герой')
    const edited = editParticipant(original, hero, {x: 1, y: 2})
    const imported = importScene(edited, exportScene(edited.state))
    expect(imported.state.scene.id).not.toBe(edited.state.scene.id)
    expect(imported.inactiveScenes[edited.state.scene.id].combatants[hero.id]).toEqual(hero)
    expect(imported.state.combat.active).toBe(false)
    expect(() => editParticipant(edited, newParticipant('creature', 'Враг'), {x: 1, y: 2})).toThrow(
        'Нарушены связи сохранения',
    )
    expect(() => editParticipant(edited, hero, {x: 8, y: 0})).toThrow('Нарушены связи сохранения')
    edited.state.combat.active = true
    expect(() => editParticipant(edited, hero, {x: 3, y: 2})).toThrow('завершите бой')
})
