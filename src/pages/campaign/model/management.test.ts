import {describe, expect, it} from 'vitest'

import {executeCommand} from './engine/execute'
import {
    newCampaign,
    newScene,
    editParticipant,
    switchScene,
    exportBundle,
    importBundle,
    newParticipant,
} from './management'
import {createRepository} from './repository/indexedDb'

describe('кампании и JSON', () => {
    it('история с подменённым событием не импортируется', async () => {
        const repo = createRepository(crypto.randomUUID())
        const s = newCampaign('История', 12, 10)
        const snapshot = await repo.create(s, 'История')
        const raw = JSON.parse(await exportBundle(repo, s.id)) as {
            snapshot: {events: unknown[]}
            actions: unknown[]
        }
        raw.snapshot.events = [
            {
                type: 'combatEnded',
                id: 'fake',
                sequence: 0,
                commandId: 'none',
                messageId: 'none',
                timestamp: 'now',
                sceneId: s.scene.id,
            },
        ]
        await expect(importBundle(repo, JSON.stringify(raw))).rejects.toThrow('истории')
        expect(await repo.list()).toHaveLength(1)
        expect((await repo.load(snapshot.state.id))?.events).toHaveLength(0)
    })
    it('создаёт кампании, сцены и независимых участников', async () => {
        const repo = createRepository(crypto.randomUUID())
        const first = await repo.create(newCampaign('Первая', 12, 10), 'Первая')
        const second = await repo.create(newCampaign('Вторая', 12, 10), 'Вторая')
        const hero = newParticipant('character', 'Герой')
        hero.hp = 19
        const edited = editParticipant(first, hero, {x: 3, y: 4})
        const saved = await repo.replace(edited, first.state.revision)
        const next = newScene(saved, 'Пещера', 8, 8)
        const moved = await repo.replace(next, saved.state.revision)
        expect(Object.keys(moved.state.combatants)).toHaveLength(0)
        const back = switchScene(moved, saved.state.scene.id)
        await repo.replace(back, moved.state.revision)
        expect((await repo.load(first.state.id))?.state.combatants[hero.id].hp).toBe(19)
        expect(Object.keys((await repo.load(second.state.id))!.state.combatants)).toHaveLength(0)
        expect(await repo.list()).toHaveLength(2)
    })
    it('экспорт и импорт копии сохраняют историю и replay', async () => {
        const repo = createRepository(crypto.randomUUID())
        const state = newCampaign('Бой', 12, 10)
        const hero = newParticipant('character', 'Герой')
        const monster = newParticipant('creature', 'Монстр')
        let snap = await repo.create(state, 'Бой')
        for (const [actor, pos] of [
            [hero, {x: 3, y: 3}],
            [monster, {x: 4, y: 3}],
        ] as const) {
            const next = editParticipant(snap, actor, pos)
            snap = await repo.replace(next, snap.state.revision)
        }
        const command = {
            type: 'start' as const,
            id: 'start-export',
            messageId: 'msg-export',
            expectedRevision: snap.state.revision,
        }
        const result = executeCommand(snap.state, command, {roll: () => 15})
        if (result.kind !== 'accepted') throw Error('Отказ')
        await repo.commit({command, beforeState: snap.state, result, text: 'Начать бой'})
        const text = await exportBundle(repo, state.id)
        const tampered = JSON.parse(text) as {snapshot: {events: {results: {total: number}[]}[]}}
        tampered.snapshot.events[0].results[0].total = 999
        await expect(importBundle(repo, JSON.stringify(tampered))).rejects.toThrow('истории')
        const copy = await importBundle(repo, text)
        expect(copy.state.id).not.toBe(state.id)
        expect(copy.state.combatants[hero.id].hp).toBe(hero.hp)
        expect(copy.events).toHaveLength(2)
        expect(copy.events[0].commandId).not.toBe(command.id)
        expect((await repo.getAction(copy.events[0].commandId))?.beforeState.id).toBe(copy.state.id)
        expect((await repo.load(state.id))?.events[0].commandId).toBe(command.id)
        const secondCopy = await importBundle(repo, await exportBundle(repo, copy.state.id))
        expect(secondCopy.events).toHaveLength(copy.events.length)
    })
    it('повреждённый импорт и конфликт не перезаписывают оригинал', async () => {
        const repo = createRepository(crypto.randomUUID())
        const s = await repo.create(newCampaign('Тест', 8, 8), 'Тест')
        await expect(importBundle(repo, '{"version":99}')).rejects.toThrow(
            'Неподдерживаемая версия',
        )
        const next = newScene(s, 'Новая', 8, 8)
        await repo.replace(next, s.state.revision)
        await expect(repo.replace(next, s.state.revision)).rejects.toThrow('изменилось')
        expect(await repo.list()).toHaveLength(1)
    })
})
