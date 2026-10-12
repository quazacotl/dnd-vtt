import type {GameState} from './types'

/** Создаёт независимое начальное состояние демонстрационной кампании. */
export function createStarterState(): GameState {
    return {
        id: 'demo', revision: 0, ruleset: '2014',
        scene: {name: 'Руины Серебряного дозора', width: 12, height: 10, tokens: [
            {id: 'hero-token', combatantId: 'hero', x: 5, y: 5},
            {id: 'goblin-token', combatantId: 'goblin', x: 6, y: 5},
        ]},
        combatants: {
            hero: {id: 'hero', name: 'Лирам', side: 'party', hp: 28, maxHp: 28, tempHp: 0, ac: 16, dex: 2, weapons: [{id:'sword',name:'Меч',bonus:5,damageDie:8,damageBonus:3,range:5}]},
            goblin: {id: 'goblin', name: 'Гоблин', side: 'enemy', hp: 12, maxHp: 12, tempHp: 0, ac: 13, dex: 2, weapons: [{id:'scimitar',name:'Скимитар',bonus:4,damageDie:6,damageBonus:2,range:5}]},
        },
        combat: {active: false, round: 0, order: [], index: 0, actionAvailable: true},
    }
}
