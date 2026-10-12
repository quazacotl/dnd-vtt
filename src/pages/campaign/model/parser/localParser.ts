import type {IntentParser} from './types'

export const localParser: IntentParser = {
    async parse(text, context, signal) {
        signal.throwIfAborted()
        const value = text.toLowerCase().trim().replace(/[.!]$/, '').trim()
        const command = /^(?:атакую|атаковать|бью|ударяю|attack)(?:\s+(.*))?$/.exec(value)
        const unsupported = {
            kind: 'unsupported' as const,
            reason: 'Поддерживается одна атака: «Атакую гоблина мечом». Укажите известную цель и оружие; дополнительные действия не выполняются.',
        }
        if (!command) return unsupported
        let remainder = command[1] ?? ''
        const explicit = context.weapons
            .map((w) => ({
                weapon: w,
                aliases: [w.name.toLowerCase(), w.id.toLowerCase(), w.name.toLowerCase() + 'ом'],
            }))
            .filter((w) =>
                w.aliases.some((alias) => remainder === alias || remainder.endsWith(' ' + alias)),
            )
        if (explicit.length > 1) return unsupported
        const weapon =
            explicit[0]?.weapon ?? (context.weapons.length === 1 ? context.weapons[0] : null)
        if (!weapon) return unsupported
        if (explicit[0]) {
            const alias = explicit[0].aliases
                .filter((a) => remainder === a || remainder.endsWith(' ' + a))
                .sort((a, b) => b.length - a.length)[0]
            remainder = remainder.slice(0, -alias.length).trim()
        }
        const matches = context.targets.filter((t) => {
            const name = t.name.toLowerCase()
            const aliases = [
                name,
                t.id.toLowerCase(),
                name + 'а',
                name.endsWith('а') ? name.slice(0, -1) + 'у' : name + 'у',
            ]
            return aliases.includes(remainder)
        })
        if (remainder && !matches.length) return unsupported
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
