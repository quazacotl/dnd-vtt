import {describe, expect, it} from 'vitest'

import {localParser} from './localParser'
import {validateResult} from './responseValidation'
import type {ParseContext} from './types'

const context: ParseContext = {
    actorId: 'hero',
    actors: [{id: 'hero', name: 'Лирам'}],
    targets: [{id: 'goblin', name: 'Гоблин'}],
    weapons: [{id: 'sword', name: 'Меч'}],
}
const signal = () => new AbortController().signal
describe('parser движения', () => {
    it('понимает координаты и подход к цели', async () => {
        expect(await localParser.parse('Иду на 3,5', context, signal())).toEqual({
            kind: 'move',
            actorId: 'hero',
            destination: {x: 3, y: 5},
        })
        expect(
            await localParser.parse('Подхожу к гоблину и атакую мечом', context, signal()),
        ).toMatchObject({
            kind: 'intent',
            approach: true,
            actorId: 'hero',
            targetId: 'goblin',
            weaponId: 'sword',
        })
    })
    it('уточнение сохраняет намерение подойти', async () => {
        const c = {...context, targets: [...context.targets, {id: 'g2', name: 'Гоблин'}]}
        expect(
            await localParser.parse('Подхожу к гоблину и атакую мечом', c, signal()),
        ).toMatchObject({kind: 'clarification', approach: true})
    })
    it.each([
        'Не подхожу к гоблину и атакую мечом',
        'Подхожу к гоблину и атакую мечом дважды',
        'Иду на 3,5 и атакую',
        'Подхожу к гоблину и атакую луком',
    ])('не исполняет лишнее действие: %s', async (text) => {
        expect((await localParser.parse(text, context, signal())).kind).toBe('unsupported')
    })
    it('валидирует новые намерения модели и отвергает лишние поля', () => {
        expect(
            validateResult({kind: 'move', actorId: 'hero', destination: {x: 3, y: 5}}, context)
                .kind,
        ).toBe('move')
        expect(
            validateResult(
                {
                    kind: 'intent',
                    actorId: 'hero',
                    targetId: 'goblin',
                    weaponId: 'sword',
                    approach: true,
                },
                context,
            ),
        ).toMatchObject({approach: true})
        expect(() =>
            validateResult(
                {kind: 'move', actorId: 'hero', destination: {x: 3, y: 5}, hp: 0},
                context,
            ),
        ).toThrow('формат')
    })
})
