import {z} from 'zod'

import type {Combatant, GameState} from './engine/types'
import type {CampaignRepository, CampaignSnapshot, CommittedAction} from './repository/types'
import {snapshotSchema, actionSchema, combatantSchema, stateSchema} from './repository/validation'

const bundleSchema = z.object({
    format: z.literal('dnd-vtt-campaign'),
    version: z.literal(1),
    snapshot: snapshotSchema,
    actions: z.array(actionSchema),
})
function parseJson(text: string): unknown {
    try {
        return JSON.parse(text) as unknown
    } catch {
        throw Error('Файл не является корректным JSON.')
    }
}
function validateHistory(snapshot: CampaignSnapshot, actions: CommittedAction[]) {
    const records = new Map(actions.map((a) => [a.command.id, a]))
    const ids = new Set<string>()
    const scenes = new Set([snapshot.state.scene.id, ...Object.keys(snapshot.inactiveScenes)])
    const normalize = (event: CampaignSnapshot['events'][number]) =>
        JSON.stringify({...event, sequence: 0})
    for (const event of snapshot.events) {
        const action = records.get(event.commandId)
        const original = action?.result.events.find((e) => e.id === event.id)
        if (
            ids.has(event.id) ||
            !scenes.has(event.sceneId) ||
            !original ||
            normalize(original) !== normalize(event)
        )
            throw Error('Нарушены связи истории кампании.')
        ids.add(event.id)
    }
    for (const action of actions) {
        if (
            action.beforeState.id !== snapshot.state.id ||
            action.result.nextState.id !== snapshot.state.id ||
            action.result.events.some((event) => !ids.has(event.id))
        )
            throw Error('Нарушены связи истории кампании.')
    }
}
/** Экспортирует кампанию с неактивными сценами и исходными записями replay, без настроек LLM. */
export async function exportBundle(repo: CampaignRepository, id: string): Promise<string> {
    const snapshot = await repo.load(id)
    if (!snapshot) throw Error('Кампания не найдена.')
    const actions = await Promise.all(
        [...new Set(snapshot.events.map((e) => e.commandId))].map((command) =>
            repo.getAction(command),
        ),
    )
    if (actions.some((a) => !a))
        throw Error('Для части событий отсутствует история. Полный экспорт отменён.')
    return JSON.stringify(
        bundleSchema.parse({format: 'dnd-vtt-campaign', version: 1, snapshot, actions}),
        null,
        2,
    )
}
/** Импортирует проверенную кампанию как независимую копию с новыми ID команд и сообщений. */
export async function importBundle(
    repo: CampaignRepository,
    text: string,
): Promise<CampaignSnapshot> {
    const raw = parseJson(text)
    const parsed = bundleSchema.safeParse(raw)
    if (!parsed.success) throw Error('Неподдерживаемая версия или повреждённые данные кампании.')
    const {snapshot, actions} = parsed.data
    validateHistory(snapshot, actions)
    const campaignId = crypto.randomUUID()
    const actionIds = new Map<string, string>()
    const messageIds = new Map<string, string>()
    const eventIds = new Map(snapshot.events.map((e) => [e.id, crypto.randomUUID()]))
    for (const a of actions) {
        if (a.beforeState.id !== snapshot.state.id || actionIds.has(a.command.id))
            throw Error('Нарушены связи истории кампании.')
        actionIds.set(a.command.id, crypto.randomUUID())
        messageIds.set(a.command.messageId, crypto.randomUUID())
    }
    const event = (e: CampaignSnapshot['events'][number]) => {
        if (!actionIds.has(e.commandId) || !messageIds.has(e.messageId))
            throw Error('Для события отсутствует исходная команда.')
        return {
            ...e,
            id: eventIds.get(e.id)!,
            commandId: actionIds.get(e.commandId)!,
            messageId: messageIds.get(e.messageId)!,
        }
    }
    const rewrite = (state: GameState) => ({...state, id: campaignId})
    const copy: CampaignSnapshot = {
        ...snapshot,
        name: snapshot.name + ' (копия)',
        state: rewrite(snapshot.state),
        inactiveScenes: Object.fromEntries(
            Object.entries(snapshot.inactiveScenes).map(([id, s]) => [id, rewrite(s)]),
        ),
        events: snapshot.events.map(event),
    }
    const records: CommittedAction[] = actions.map((a) => ({
        ...a,
        command: {
            ...a.command,
            id: actionIds.get(a.command.id)!,
            messageId: messageIds.get(a.command.messageId)!,
        },
        beforeState: rewrite(a.beforeState),
        result: {
            ...a.result,
            nextState: rewrite(a.result.nextState),
            events: a.result.events.map(event),
        },
    }))
    return repo.importCopy(copy, records)
}
/** Экспортирует одного участника со структурированными характеристиками и снаряжением. */
export function exportCharacter(actor: Combatant): string {
    return JSON.stringify(
        {format: 'dnd-vtt-character', version: 1, character: combatantSchema.parse(actor)},
        null,
        2,
    )
}
/** Создаёт новую независимую копию участника из JSON, не заменяя существующую запись. */
export function importCharacter(text: string): Combatant {
    const parsed = z
        .object({
            format: z.literal('dnd-vtt-character'),
            version: z.literal(1),
            character: combatantSchema,
        })
        .safeParse(parseJson(text))
    if (!parsed.success) throw Error('Повреждённый JSON участника или неподдерживаемая версия.')
    return {
        ...parsed.data.character,
        id: crypto.randomUUID(),
        weapons: parsed.data.character.weapons.map((w) => ({...w, id: crypto.randomUUID()})),
    }
}
/** Экспортирует состояние сцены без истории кампании. */
export function exportScene(state: GameState): string {
    return JSON.stringify(
        {format: 'dnd-vtt-scene', version: 1, state: stateSchema.parse(state)},
        null,
        2,
    )
}
/** Добавляет сцену как копию в выбранную кампанию; бой начинается заново. */
export function importScene(snapshot: CampaignSnapshot, text: string): CampaignSnapshot {
    const parsed = z
        .object({format: z.literal('dnd-vtt-scene'), version: z.literal(1), state: stateSchema})
        .safeParse(parseJson(text))
    if (!parsed.success) throw Error('Повреждённый JSON сцены или неподдерживаемая версия.')
    const s = structuredClone(snapshot)
    s.inactiveScenes[s.state.scene.id] = s.state
    s.state = {
        ...parsed.data.state,
        id: s.state.id,
        revision: s.state.revision + 1,
        scene: {...parsed.data.state.scene, id: crypto.randomUUID()},
        combat: {
            active: false,
            round: 0,
            order: [],
            index: 0,
            actionAvailable: true,
            movementRemaining: 30,
        },
    }
    return snapshotSchema.parse(s)
}
