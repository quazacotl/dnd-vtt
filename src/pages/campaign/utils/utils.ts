import type {GameEvent, GameState} from '../model/engine/types'
import type {ParseContext} from '../model/parser/types'

/** Строит минимальный контекст parser для действующего участника. */
export function buildContext(state: GameState): ParseContext {
    const id = state.combat.order[state.combat.index] ?? 'hero'
    const actor = state.combatants[id]
    return {
        actorId: id,
        actors: [{id, name: actor.name}],
        targets: Object.values(state.combatants)
            .filter((c) => c.id !== id && c.hp > 0)
            .map((c) => ({id: c.id, name: c.name})),
        weapons: actor.weapons.map((w) => ({id: w.id, name: w.name})),
    }
}
/** Представляет подтверждённые события боя в читаемом виде. */
export function describeEvent(event: GameEvent, state: GameState): string {
    const name = (id: string) => state.combatants[id]?.name ?? id
    switch (event.type) {
        case 'initiative':
            return (
                'Инициатива: ' +
                event.results.map((r) => `${name(r.id)} — ${r.total} (d20: ${r.die})`).join('; ')
            )
        case 'turn':
            return `Раунд ${event.round} · Ход: ${name(event.actorId)}`
        case 'attackRoll':
            return `${name(event.actorId)} → ${name(event.targetId)}: d20 ${event.die} + ${event.bonus} = ${event.total} против AC ${event.ac}. ${event.critical ? 'Критический удар!' : event.hit ? 'Попадание.' : 'Промах.'}`
        case 'damage':
            return `Урон: ${event.amount} (${event.dice.join(' + ')} + ${event.bonus}). ${name(event.targetId)}: HP ${event.beforeHp} → ${event.afterHp}${event.beforeTempHp ? `, временные HP ${event.beforeTempHp} → ${event.afterTempHp}` : ''}.`
        case 'combatEnded':
            return 'Бой завершён.'
    }
}
