import {createStore} from 'zustand/vanilla'

import {buildContext} from '../utils/utils'
import {executeCommand} from './engine/execute'
import {createStarterState} from './engine/starter'
import type {Cell, DiceSource, GameCommand} from './engine/types'
import type {IntentParser, ParseResult} from './parser/types'
import type {CampaignRepository, CampaignSnapshot, CommittedAction} from './repository/types'

interface CampaignView {
    snapshot: CampaignSnapshot | null
    status: 'loading' | 'empty' | 'ready' | 'partial' | 'error'
    busy: boolean
    parsing: boolean
    texts: Record<string, string>
    error: string | null
    pendingSave: CommittedAction | null
    clarification: Extract<ParseResult, {kind: 'clarification'}> | null
    clarificationText: string
    animation: CommittedAction | null
    notice: string | null
}
/** Создаёт самостоятельный сценарий с подтверждением записи перед публикацией результата. */
export function createCampaignController(deps: {
    repository: CampaignRepository
    parser: IntentParser
    dice: DiceSource
}) {
    const store = createStore<CampaignView>(() => ({
        snapshot: null,
        status: 'loading',
        busy: false,
        parsing: false,
        texts: {},
        error: null,
        pendingSave: null,
        clarification: null,
        clarificationText: '',
        animation: null,
        notice: null,
    }))
    let parser = deps.parser
    let abort: AbortController | null = null
    let generation = 0
    const fail = (error: unknown) =>
        store.setState({
            error: error instanceof Error ? error.message : 'Неизвестная ошибка.',
            status: store.getState().snapshot ? 'partial' : 'error',
            busy: false,
        })
    const persist = async (action: CommittedAction) => {
        try {
            const snapshot = await deps.repository.commit(action)
            store.setState({
                snapshot,
                status: 'ready',
                busy: false,
                pendingSave: null,
                error: null,
                animation: action,
                notice: null,
                texts: {...store.getState().texts, [action.command.id]: action.text},
            })
        } catch (error) {
            store.setState({pendingSave: action})
            fail(error)
        }
    }
    const execute = async (command: GameCommand, text: string) => {
        const beforeState = store.getState().snapshot?.state
        if (!beforeState) return
        const result = executeCommand(beforeState, command, deps.dice)
        if (result.kind === 'rejected') {
            store.setState({error: result.message, busy: false})
            return
        }
        await persist({command, beforeState, result, text})
    }
    const blocked = () => {
        const s = store.getState()
        return s.busy || !!s.pendingSave || !!s.animation
    }
    const base = () => ({
        id: crypto.randomUUID(),
        messageId: crypto.randomUUID(),
        expectedRevision: store.getState().snapshot!.state.revision,
    })
    const cancelRequest = () => {
        generation++
        if (abort) {
            abort.abort()
            store.setState({busy: false, parsing: false})
        }
        abort = null
        store.setState({clarification: null})
    }
    const controller = {
        store,
        async load(id: string) {
            cancelRequest()
            store.setState({
                status: 'loading',
                snapshot: null,
                error: null,
                pendingSave: null,
                animation: null,
                texts: {},
                busy: false,
            })
            const ticket = generation
            try {
                const snapshot = await deps.repository.load(id)
                const actions = snapshot
                    ? await Promise.all(
                          [...new Set(snapshot.events.map((e) => e.commandId))].map((commandId) =>
                              deps.repository.getAction(commandId),
                          ),
                      )
                    : []
                const texts = Object.fromEntries(
                    actions.filter((a) => a !== null).map((a) => [a.command.id, a.text]),
                )
                if (ticket === generation)
                    store.setState({snapshot, texts, status: snapshot ? 'ready' : 'empty'})
            } catch (e) {
                if (ticket === generation) fail(e)
            }
        },
        async createDemo() {
            if (store.getState().busy) return
            store.setState({busy: true, error: null})
            try {
                const snapshot = await deps.repository.create(createStarterState())
                store.setState({snapshot, status: 'ready', busy: false})
            } catch (e) {
                fail(e)
            }
        },
        async startCombat() {
            if (blocked()) return
            store.setState({busy: true, error: null})
            await execute({...base(), type: 'start'}, 'Начать бой')
        },
        async endTurn() {
            if (blocked()) return
            store.setState({busy: true, error: null, clarification: null})
            await execute({...base(), type: 'end'}, 'Завершить ход')
        },
        async moveTo(destination: Cell, actorId: string) {
            if (blocked() || !store.getState().snapshot) return
            store.setState({busy: true, error: null, clarification: null})
            await execute(
                {...base(), type: 'move', actorId, destination},
                `Перемещаюсь на ${destination.x},${destination.y}`,
            )
        },
        async submitMessage(text: string) {
            if (blocked() || !text.trim()) return
            const snapshot = store.getState().snapshot
            if (!snapshot) return
            store.setState({
                busy: true,
                parsing: true,
                error: null,
                notice: null,
                clarification: null,
            })
            abort = new AbortController()
            const signal = abort.signal
            const ticket = ++generation
            try {
                const result = await parser.parse(text, buildContext(snapshot.state), signal)
                if (signal.aborted || ticket !== generation) return
                abort = null
                store.setState({parsing: false})
                if (snapshot.state.revision !== store.getState().snapshot?.state.revision)
                    throw Error('Игра изменилась во время запроса. Повторите действие.')
                if (result.kind === 'unsupported') {
                    store.setState({notice: result.reason, busy: false})
                    return
                }
                if (result.kind === 'clarification') {
                    store.setState({clarification: result, clarificationText: text, busy: false})
                    return
                }
                if (result.kind === 'move') {
                    await execute(
                        {
                            ...base(),
                            type: 'move',
                            actorId: result.actorId,
                            destination: result.destination,
                        },
                        text,
                    )
                    return
                }
                await execute(
                    {
                        ...base(),
                        type: result.approach ? 'approachAttack' : 'attack',
                        actorId: result.actorId,
                        targetId: result.targetId,
                        weaponId: result.weaponId,
                    },
                    text,
                )
            } catch (e) {
                if (ticket === generation) {
                    abort = null
                    store.setState({parsing: false})
                }
                if (ticket === generation && !signal.aborted) fail(e)
            }
        },
        async chooseTarget(targetId: string) {
            if (blocked()) return
            const s = store.getState()
            const c = s.clarification
            if (!c || !c.options.some((o) => o.id === targetId)) return
            store.setState({clarification: null, busy: true, error: null})
            await execute(
                {
                    ...base(),
                    type: c.approach ? 'approachAttack' : 'attack',
                    actorId: c.actorId,
                    targetId,
                    weaponId: c.weaponId,
                },
                s.clarificationText,
            )
        },
        async retrySave() {
            const a = store.getState().pendingSave
            if (!a || store.getState().busy) return
            store.setState({busy: true})
            await persist(a)
        },
        cancelRequest,
        setParser(value: IntentParser) {
            cancelRequest()
            parser = value
        },
        finishAnimation() {
            store.setState({animation: null})
        },
        async replay(id: string) {
            if (blocked()) return
            store.setState({busy: true, error: null})
            try {
                const action = await deps.repository.getAction(id)
                store.setState({animation: action, busy: false})
            } catch (e) {
                fail(e)
            }
        },
    }
    return controller
}
export type CampaignController = ReturnType<typeof createCampaignController>
