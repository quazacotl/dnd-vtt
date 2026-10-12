import {config} from '@/shared/config'

import type {GameEvent, GameState} from '../model/engine/types'
import type {ParseContext} from '../model/parser/types'

/** В dev направляет запросы настроенного Qwen через Vite; остальные адреса остаются прямыми. */
export function resolveLlmEndpoint(baseUrl: string, devMode = import.meta.env.DEV): string {
    const base = baseUrl.replace(/\/+$/, '')
    const configured = config.apiBaseUrl.replace(/\/+$/, '')
    return (devMode && base === configured ? config.llmProxyPath : base) + '/chat/completions'
}

/** Строит минимальный контекст parser для действующего участника. */
export function buildContext(state: GameState): ParseContext {
    const id = state.combat.order[state.combat.index] ?? Object.keys(state.combatants)[0] ?? ''
    const actor = state.combatants[id]
    if (!actor) return {actorId: '', actors: [], targets: [], weapons: []}
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
        case 'movement': {
            const end = event.path.at(-1)!
            return `${name(event.actorId)}: перемещение на ${end.x},${end.y} · ${event.costFeet} футов.`
        }
    }
}

/** Форматирует именованные числовые значения для редактора. */
export const formatNamedNumbers = (data: Record<string, number>) =>
    Object.entries(data)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n')
/** Читает отдельные строки, сохраняя повторяющиеся названия предметов. */
export function parseNamedEntries(text: string): readonly (readonly [string, number])[] {
    const entries = text
        .split('\n')
        .filter((l) => l.trim())
        .map((line) => {
            const pos = line.lastIndexOf(':')
            const key = line.slice(0, pos).trim()
            const value = Number(line.slice(pos + 1).trim())
            if (pos < 1 || !Number.isFinite(value))
                throw Error('Используйте формат «название: число», по одной записи на строку.')
            return [key, value] as const
        })
    return entries
}

/** Читает карту бонусов и отклоняет повторяющиеся названия. */
export function parseNamedNumbers(text: string): Record<string, number> {
    const entries = parseNamedEntries(text)
    if (new Set(entries.map(([name]) => name)).size !== entries.length)
        throw Error('Названия навыков и спасбросков не должны повторяться.')
    return Object.fromEntries(entries)
}
