import {z} from 'zod'

const base = {
    id: z.string().min(1),
    messageId: z.string().min(1),
    expectedRevision: z.number().int().nonnegative(),
}
export const commandSchema = z.discriminatedUnion('type', [
    z.strictObject({...base, type: z.literal('start')}),
    z.strictObject({...base, type: z.literal('end')}),
    z.strictObject({...base, type: z.literal('stop')}),
    z.strictObject({
        ...base,
        type: z.enum(['attack', 'approachAttack']),
        actorId: z.string().min(1),
        targetId: z.string().min(1),
        weaponId: z.string().min(1),
    }),
    z.strictObject({
        ...base,
        type: z.literal('move'),
        actorId: z.string().min(1),
        destination: z.strictObject({
            x: z.number().int().nonnegative(),
            y: z.number().int().nonnegative(),
        }),
    }),
])
