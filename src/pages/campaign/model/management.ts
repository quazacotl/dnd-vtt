import {createStarterState} from './engine/starter'
import type {Cell, Combatant, GameState} from './engine/types'
import type {CampaignRepository, CampaignSnapshot} from './repository/types'
import {snapshotSchema, combatantSchema, stateSchema} from './repository/validation'
export {exportBundle, importBundle} from './transfer'

/** Создаёт пустую кампанию с собственной сценой и идентификаторами. */
export function newCampaign(name: string, width: number, height: number): GameState {
    const state = createStarterState()
    state.id = crypto.randomUUID()
    state.scene = {
        id: crypto.randomUUID(),
        name: name.trim(),
        width,
        height,
        obstacles: [],
        tokens: [],
    }
    state.combatants = {}
    return stateSchema.parse(state)
}
/** Создаёт редактируемого участника, не раскрывая коллекции шаблонов. */
export function newParticipant(kind: 'character' | 'creature', name: string): Combatant {
    const c = structuredClone(
        createStarterState().combatants[kind === 'character' ? 'hero' : 'goblin'],
    )
    c.id = crypto.randomUUID()
    c.name = name
    c.details = {
        kind,
        level: kind === 'character' ? 1 : 0,
        className: '',
        species: '',
        abilities: {str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10},
        skills: {},
        saves: {},
        inventory: [],
        spells: [],
        features: [],
        conditions: [],
        notes: '',
    }
    for (const w of c.weapons) w.id = crypto.randomUUID()
    return c
}
function editable(s: CampaignSnapshot) {
    if (s.state.combat.active)
        throw Error('Сначала завершите бой, чтобы редактировать участников и сцену.')
}
/** Сохраняет героя или монстра и его размещение вне боя; проверяет карту и коллизии. */
export function editParticipant(
    snapshot: CampaignSnapshot,
    actor: Combatant,
    position: Cell,
): CampaignSnapshot {
    editable(snapshot)
    const s = structuredClone(snapshot)
    const c = combatantSchema.parse(actor)
    s.state.combatants[c.id] = c
    const old = s.state.scene.tokens.find((t) => t.combatantId === c.id)
    if (old) Object.assign(old, position)
    else s.state.scene.tokens.push({id: crypto.randomUUID(), combatantId: c.id, ...position})
    s.state.combat = {
        active: false,
        round: 0,
        order: [],
        index: 0,
        actionAvailable: true,
        movementRemaining: 30,
    }
    s.state.revision++
    return snapshotSchema.parse(s)
}
/** Удаляет участника текущей сцены вне боя, сохраняя прошлую историю. */
export function removeParticipant(snapshot: CampaignSnapshot, id: string): CampaignSnapshot {
    editable(snapshot)
    const s = structuredClone(snapshot)
    delete s.state.combatants[id]
    s.state.scene.tokens = s.state.scene.tokens.filter((t) => t.combatantId !== id)
    s.state.combat = {
        active: false,
        round: 0,
        order: [],
        index: 0,
        actionAvailable: true,
        movementRemaining: 30,
    }
    s.state.revision++
    return snapshotSchema.parse(s)
}
/** Создаёт пустую сцену, сохраняя прежнюю как неактивную. */
export function newScene(
    snapshot: CampaignSnapshot,
    name: string,
    width: number,
    height: number,
): CampaignSnapshot {
    const s = structuredClone(snapshot)
    const next = newCampaign(name, width, height)
    next.id = s.state.id
    next.revision = s.state.revision + 1
    s.inactiveScenes[s.state.scene.id] = s.state
    s.state = next
    return snapshotSchema.parse(s)
}
/** Переключает сцену без сброса её участников, позиции и состояния боя. */
export function switchScene(snapshot: CampaignSnapshot, id: string): CampaignSnapshot {
    if (!Object.hasOwn(snapshot.inactiveScenes, id)) throw Error('Сцена не найдена.')
    const s = structuredClone(snapshot)
    const next = s.inactiveScenes[id]
    delete s.inactiveScenes[id]
    s.inactiveScenes[s.state.scene.id] = s.state
    next.revision = s.state.revision + 1
    s.state = next
    return snapshotSchema.parse(s)
}
/** Возвращает первую свободную клетку карты для добавления участника. */
export function freeCell(state: GameState): Cell {
    for (let y = 0; y < state.scene.height; y++)
        for (let x = 0; x < state.scene.width; x++) {
            if (
                ![...state.scene.tokens, ...state.scene.obstacles].some(
                    (c) => c.x === x && c.y === y,
                )
            )
                return {x, y}
        }
    throw Error('На карте нет свободной клетки.')
}
/** Записывает правку с проверкой ревизии, без скрытого перезаписывания чужой версии. */
export async function saveManagement(
    repo: CampaignRepository,
    before: CampaignSnapshot,
    next: CampaignSnapshot,
) {
    return repo.replace(next, before.state.revision)
}
