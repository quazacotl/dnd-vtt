import type {Cell, GameState} from './types'

/** Возвращает клетки стен и колонн демонстрационной карты в её границах. */
export function createStarterObstacles(width = 12, height = 10): Cell[] {
    return [
        [1, 1],
        [2, 1],
        [3, 1],
        [1, 2],
        [8, 1],
        [9, 1],
        [10, 1],
        [10, 2],
        [1, 8],
        [2, 8],
        [3, 8],
        [8, 8],
        [9, 8],
        [10, 8],
        [2, 3],
        [9, 3],
        [2, 7],
        [9, 7],
    ]
        .map(([x, y]) => ({x, y}))
        .filter((p) => p.x < width && p.y < height)
}

/** Создаёт независимое начальное состояние демонстрационной кампании. */
export function createStarterState(): GameState {
    return {
        id: 'demo',
        revision: 0,
        ruleset: '2014',
        scene: {
            id: 'initial',
            name: 'Руины Серебряного дозора',
            width: 12,
            height: 10,
            obstacles: createStarterObstacles(),
            tokens: [
                {id: 'hero-token', combatantId: 'hero', x: 5, y: 5},
                {id: 'goblin-token', combatantId: 'goblin', x: 6, y: 5},
            ],
        },
        combatants: {
            hero: {
                id: 'hero',
                name: 'Лирам',
                side: 'party',
                hp: 28,
                maxHp: 28,
                tempHp: 0,
                ac: 16,
                dex: 2,
                speed: 30,
                weapons: [
                    {id: 'sword', name: 'Меч', bonus: 5, damageDie: 8, damageBonus: 3, range: 5},
                ],
            },
            goblin: {
                id: 'goblin',
                name: 'Гоблин',
                side: 'enemy',
                hp: 12,
                maxHp: 12,
                tempHp: 0,
                ac: 13,
                dex: 2,
                speed: 30,
                weapons: [
                    {
                        id: 'scimitar',
                        name: 'Скимитар',
                        bonus: 4,
                        damageDie: 6,
                        damageBonus: 2,
                        range: 5,
                    },
                ],
            },
        },
        combat: {
            active: false,
            round: 0,
            order: [],
            index: 0,
            actionAvailable: true,
            movementRemaining: 30,
        },
    }
}
