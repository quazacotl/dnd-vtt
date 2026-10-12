import {config} from '@/shared/config'

import {commandSchema} from './command'
import {findPath, findApproachPath} from './movement'
import type {DiceSource, ExecutionResult, GameCommand, GameEvent, GameState} from './types'

/** Проверяет команду и рассчитывает новый снимок без изменения исходного состояния. */
export function executeCommand(
    state: GameState,
    command: GameCommand,
    dice: DiceSource,
): ExecutionResult {
    const reject = (code: string, message: string): ExecutionResult => ({
        kind: 'rejected',
        code,
        message,
    })
    if (!commandSchema.safeParse(command).success)
        return reject('schema', 'Неверный формат игровой команды.')
    if (command.expectedRevision !== state.revision)
        return reject('revision', 'Состояние изменилось. Повторите действие.')
    const nextState = structuredClone(state)
    const events: GameEvent[] = []
    type Payload = GameEvent extends infer E
        ? E extends GameEvent
            ? Omit<E, 'id' | 'sequence' | 'commandId' | 'messageId' | 'timestamp'>
            : never
        : never
    const emit = (payload: Payload) =>
        events.push({
            ...payload,
            id: crypto.randomUUID(),
            sequence: events.length,
            commandId: command.id,
            messageId: command.messageId,
            timestamp: new Date().toISOString(),
        } as GameEvent)
    if (command.type === 'start') {
        if (state.combat.active) return reject('active', 'Бой уже начат.')
        const living = Object.values(state.combatants).filter((c) => c.hp > 0)
        if (new Set(living.map((c) => c.side)).size < 2)
            return reject('sides', 'Для боя нужны две стороны с живыми участниками.')
        const results = living
            .map((c) => {
                const die = dice.roll(20)
                return {id: c.id, die, total: die + c.dex}
            })
            .sort((a, b) => b.total - a.total || a.id.localeCompare(b.id))
        nextState.combat = {
            active: true,
            round: 1,
            index: 0,
            order: results.map((r) => r.id),
            actionAvailable: true,
            movementRemaining: nextState.combatants[results[0].id].speed,
        }
        emit({type: 'initiative', results})
        emit({type: 'turn', actorId: results[0].id, round: 1})
    } else {
        if (!state.combat.active) return reject('inactive', 'Сначала начните бой.')
        const activeId = state.combat.order[state.combat.index]
        if (command.type === 'end') {
            let index = state.combat.index
            do {
                index = (index + 1) % state.combat.order.length
                if (index === 0) nextState.combat.round++
            } while (
                state.combatants[state.combat.order[index]].hp <= 0 &&
                index !== state.combat.index
            )
            nextState.combat.index = index
            nextState.combat.actionAvailable = true
            nextState.combat.movementRemaining =
                nextState.combatants[state.combat.order[index]].speed
            emit({type: 'turn', actorId: state.combat.order[index], round: nextState.combat.round})
        } else if (command.type === 'move') {
            if (
                !Object.hasOwn(state.combatants, command.actorId) ||
                state.combatants[command.actorId].hp <= 0 ||
                command.actorId !== activeId
            )
                return reject('turn', 'Перемещаться может только действующий участник.')
            const path = findPath(state, command.actorId, command.destination)
            if (!path || path.length < 2)
                return reject('path', 'Клетка недоступна для перемещения.')
            const costFeet = (path.length - 1) * config.cellFeet
            if (costFeet > state.combat.movementRemaining)
                return reject('movement', 'Недостаточно движения в этом ходу.')
            const token = nextState.scene.tokens.find((t) => t.combatantId === command.actorId)!
            Object.assign(token, path.at(-1))
            nextState.combat.movementRemaining -= costFeet
            emit({type: 'movement', actorId: command.actorId, path, costFeet})
        } else {
            const actor = nextState.combatants[command.actorId]
            const target = nextState.combatants[command.targetId]
            if (!actor || !target || target.hp <= 0 || actor.hp <= 0 || actor.id === target.id)
                return reject('target', 'Участник или цель недоступны.')
            if (actor.id !== activeId) return reject('turn', 'Сейчас ход другого участника.')
            if (!state.combat.actionAvailable)
                return reject('resource', 'Действие в этом ходу уже использовано.')
            const weapon = actor.weapons.find((w) => w.id === command.weaponId)
            if (!weapon) return reject('weapon', 'Оружие не найдено.')
            if (command.type === 'approachAttack') {
                const path = findApproachPath(state, actor.id, target.id, weapon.range)
                if (!path)
                    return reject('path', 'Невозможно подойти и атаковать за оставшееся движение.')
                if (path.length > 1) {
                    const costFeet = (path.length - 1) * config.cellFeet
                    Object.assign(
                        nextState.scene.tokens.find((t) => t.combatantId === actor.id)!,
                        path.at(-1),
                    )
                    nextState.combat.movementRemaining -= costFeet
                    emit({type: 'movement', actorId: actor.id, path, costFeet})
                }
            }
            const from = nextState.scene.tokens.find((t) => t.combatantId === actor.id)
            const to = state.scene.tokens.find((t) => t.combatantId === target.id)
            if (
                !from ||
                !to ||
                Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y)) * config.cellFeet >
                    weapon.range
            )
                return reject('range', 'Цель вне досягаемости оружия.')
            const die = dice.roll(20)
            const total = die + weapon.bonus
            const critical = die === 20
            const hit = critical || (die !== 1 && total >= target.ac)
            nextState.combat.actionAvailable = false
            emit({
                type: 'attackRoll',
                actorId: actor.id,
                targetId: target.id,
                die,
                bonus: weapon.bonus,
                total,
                ac: target.ac,
                hit,
                critical,
            })
            if (hit) {
                const rolls = Array.from({length: critical ? 2 : 1}, () =>
                    dice.roll(weapon.damageDie),
                )
                const amount = Math.max(
                    0,
                    rolls.reduce((sum, n) => sum + n, 0) + weapon.damageBonus,
                )
                const beforeHp = target.hp
                const beforeTempHp = target.tempHp
                const absorbed = Math.min(target.tempHp, amount)
                target.tempHp -= absorbed
                target.hp = Math.max(0, target.hp - (amount - absorbed))
                emit({
                    type: 'damage',
                    actorId: actor.id,
                    targetId: target.id,
                    dice: rolls,
                    bonus: weapon.damageBonus,
                    amount,
                    beforeHp,
                    afterHp: target.hp,
                    beforeTempHp,
                    afterTempHp: target.tempHp,
                })
                if (
                    new Set(
                        Object.values(nextState.combatants)
                            .filter((c) => c.hp > 0)
                            .map((c) => c.side),
                    ).size < 2
                ) {
                    nextState.combat.active = false
                    emit({type: 'combatEnded'})
                }
            }
        }
    }
    nextState.revision++
    return {kind: 'accepted', nextState, events}
}
