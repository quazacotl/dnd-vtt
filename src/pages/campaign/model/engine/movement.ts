import {config} from '@/shared/config'

import type {Cell, GameState} from './types'

const key = (c: Cell) => `${c.x},${c.y}`
const directions = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
]
function search(state: GameState, actorId: string, maxSteps: number) {
    const token = state.scene.tokens.find((t) => t.combatantId === actorId)
    const paths = new Map<string, Cell[]>()
    if (!token) return paths
    const occupied = new Set(
        [
            ...state.scene.obstacles,
            ...state.scene.tokens.filter((t) => t.combatantId !== actorId),
        ].map(key),
    )
    const valid = (c: Cell) =>
        c.x >= 0 &&
        c.y >= 0 &&
        c.x < state.scene.width &&
        c.y < state.scene.height &&
        !occupied.has(key(c))
    const origin = {x: token.x, y: token.y}
    paths.set(key(origin), [origin])
    const queue = [origin]
    for (let i = 0; i < queue.length; i++) {
        const cell = queue[i]
        const path = paths.get(key(cell))!
        if (path.length - 1 >= maxSteps) continue
        for (const [dx, dy] of directions) {
            const next = {x: cell.x + dx, y: cell.y + dy}
            if (paths.has(key(next)) || !valid(next)) continue
            if (
                dx &&
                dy &&
                (!valid({x: cell.x + dx, y: cell.y}) || !valid({x: cell.x, y: cell.y + dy}))
            )
                continue
            paths.set(key(next), [...path, next])
            queue.push(next)
        }
    }
    return paths
}
/** Ищет кратчайший путь по сетке, не проходя через токены, стены и закрытые углы. */
export function findPath(state: GameState, actorId: string, destination: Cell): Cell[] | null {
    return (
        search(state, actorId, state.scene.width * state.scene.height).get(key(destination)) ?? null
    )
}
/** Возвращает клетки в текущем бюджете движения действующего участника. */
export function reachableCells(state: GameState, actorId: string): Cell[] {
    if (
        !state.combat.active ||
        state.combat.order[state.combat.index] !== actorId ||
        !Object.hasOwn(state.combatants, actorId) ||
        state.combatants[actorId].hp <= 0
    )
        return []
    return [
        ...search(
            state,
            actorId,
            Math.floor(state.combat.movementRemaining / config.cellFeet),
        ).values(),
    ]
        .filter((p) => p.length > 1)
        .map((p) => p.at(-1)!)
}
/** Выбирает кратчайший допустимый путь до клетки в дальности оружия от цели. */
export function findApproachPath(
    state: GameState,
    actorId: string,
    targetId: string,
    range: number,
): Cell[] | null {
    const target = state.scene.tokens.find((t) => t.combatantId === targetId)
    if (!target) return null
    for (const path of search(
        state,
        actorId,
        Math.floor(state.combat.movementRemaining / config.cellFeet),
    ).values()) {
        const end = path.at(-1)!
        if (
            Math.max(Math.abs(end.x - target.x), Math.abs(end.y - target.y)) * config.cellFeet <=
            range
        )
            return path
    }
    return null
}
