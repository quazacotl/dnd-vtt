import type {IntentParser} from './types'

export const localParser: IntentParser = {
    async parse(text, context, signal) {
        signal.throwIfAborted()
        const value = text.toLowerCase().trim()
        if (/подх|перемещ|иду|move|walk/.test(value))
            return {
                kind: 'unsupported',
                reason: 'Перемещение и составные действия будут доступны в следующем срезе.',
            }
        if (!/атак|удар|бью|attack/.test(value))
            return {kind: 'unsupported', reason: 'Попробуйте: «Атакую гоблина мечом».'}
        const matches = context.targets.filter(
            (t) =>
                value.includes(t.name.toLowerCase().slice(0, -1)) ||
                value.includes(t.id.toLowerCase()),
        )
        const weapons = context.weapons.filter((w) =>
            value.includes(w.name.toLowerCase().slice(0, Math.max(3, w.name.length - 1))),
        )
        const weapon =
            weapons.length === 1
                ? weapons[0]
                : context.weapons.length === 1
                  ? context.weapons[0]
                  : null
        if (!weapon) return {kind: 'unsupported', reason: 'Укажите оружие из списка участника.'}
        if (matches.length !== 1)
            return {
                kind: 'clarification',
                question: 'Кого атаковать?',
                options: matches.length ? matches : context.targets,
                actorId: context.actorId,
                weaponId: weapon.id,
            }
        return {
            kind: 'intent',
            actorId: context.actorId,
            targetId: matches[0].id,
            weaponId: weapon.id,
        }
    },
}
