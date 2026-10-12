import {z} from 'zod'

import type {ParseContext, ParseResult} from './types'

const ref = z.strictObject({id: z.string(), name: z.string()})
const resultSchema = z.discriminatedUnion('kind', [
    z.strictObject({
        kind: z.literal('intent'),
        actorId: z.string(),
        targetId: z.string(),
        weaponId: z.string(),
    }),
    z.strictObject({
        kind: z.literal('clarification'),
        question: z.string().min(1),
        options: z.array(ref).min(1),
        actorId: z.string(),
        weaponId: z.string(),
    }),
    z.strictObject({kind: z.literal('unsupported'), reason: z.string().min(1)}),
])
/** Проверяет ответ parser и ссылки на разрешённые сущности текущего контекста. */
export function validateResult(raw: unknown, context: ParseContext): ParseResult {
    const r = resultSchema.safeParse(raw)
    if (!r.success) throw Error('Модель вернула неподдерживаемый формат команды.')
    const value = r.data
    if (value.kind === 'unsupported') return value
    if (value.actorId !== context.actorId || !context.weapons.some((w) => w.id === value.weaponId))
        throw Error('Модель указала неизвестного участника или оружие.')
    const ids = value.kind === 'intent' ? [value.targetId] : value.options.map((o) => o.id)
    if (ids.some((id) => !context.targets.some((t) => t.id === id)))
        throw Error('Модель указала неизвестную цель.')
    return value.kind === 'clarification'
        ? {...value, options: context.targets.filter((t) => ids.includes(t.id))}
        : value
}
