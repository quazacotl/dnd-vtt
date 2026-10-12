import {z} from 'zod'

const base = {
    id: z.string().min(1),
    messageId: z.string().min(1),
    expectedRevision: z.number().int().nonnegative(),
}
export const commandSchema = z.discriminatedUnion('type', [
    z.strictObject({...base, type: z.literal('start')}),
    z.strictObject({...base, type: z.literal('end')}),
    z.strictObject({
        ...base,
        type: z.literal('attack'),
        actorId: z.string().min(1),
        targetId: z.string().min(1),
        weaponId: z.string().min(1),
    }),
])
