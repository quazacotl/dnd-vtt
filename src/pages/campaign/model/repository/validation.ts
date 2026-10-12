import {z} from 'zod'

import {commandSchema} from '../engine/command'
import {createStarterObstacles} from '../engine/starter'

const entityId = z
    .string()
    .min(1)
    .refine(
        (id) => !['__proto__', 'constructor', 'prototype'].includes(id),
        'Недопустимый идентификатор',
    )
const details = z.object({
    kind: z.enum(['character', 'creature']),
    level: z.number().int().min(0).max(100),
    className: z.string(),
    species: z.string(),
    abilities: z.object({
        str: z.number().int().min(1).max(99),
        dex: z.number().int().min(1).max(99),
        con: z.number().int().min(1).max(99),
        int: z.number().int().min(1).max(99),
        wis: z.number().int().min(1).max(99),
        cha: z.number().int().min(1).max(99),
    }),
    skills: z.record(entityId, z.number()),
    saves: z.record(entityId, z.number()),
    inventory: z.array(z.object({name: z.string().min(1), count: z.number().int().nonnegative()})),
    spells: z.array(
        z.object({
            name: z.string().min(1),
            level: z.number().int().min(0).max(9),
            description: z.string(),
        }),
    ),
    features: z.array(z.string()),
    conditions: z.array(z.string()),
    notes: z.string(),
})

const weapon = z.object({
    id: z.string(),
    name: z.string(),
    bonus: z.number().int(),
    damageDie: z.number().int().min(2).max(100),
    damageBonus: z.number().int(),
    range: z.number().nonnegative(),
    diceCount: z.number().int().min(1).max(20).optional(),
})
export const combatantSchema = z
    .object({
        id: entityId,
        name: z.string().trim().min(1).max(80),
        side: z.enum(['party', 'enemy']),
        hp: z.number().nonnegative(),
        maxHp: z.number().positive(),
        tempHp: z.number().nonnegative(),
        ac: z.number(),
        dex: z.number(),
        speed: z.number().nonnegative().default(30),
        weapons: z.array(weapon),
        details: details.optional(),
    })
    .refine((c) => c.hp <= c.maxHp, 'HP не может превышать максимальное значение')
export const stateSchema = z
    .object({
        id: z.string(),
        revision: z.number().int().nonnegative(),
        ruleset: z.literal('2014'),
        scene: z
            .object({
                id: entityId.default('initial'),
                name: z.string(),
                width: z.number().int().positive().max(50),
                height: z.number().int().positive().max(50),
                obstacles: z
                    .array(
                        z.object({
                            x: z.number().int().nonnegative(),
                            y: z.number().int().nonnegative(),
                        }),
                    )
                    .optional(),
                tokens: z.array(
                    z.object({
                        id: z.string(),
                        combatantId: z.string(),
                        x: z.number().int().nonnegative(),
                        y: z.number().int().nonnegative(),
                    }),
                ),
            })
            .transform((scene) => ({
                ...scene,
                obstacles: scene.obstacles ?? createStarterObstacles(scene.width, scene.height),
            })),
        combatants: z.record(entityId, combatantSchema),
        combat: z.object({
            active: z.boolean(),
            round: z.number().int().nonnegative(),
            order: z.array(z.string()),
            index: z.number().int().nonnegative(),
            actionAvailable: z.boolean(),
            movementRemaining: z.number().nonnegative().default(30),
        }),
    })
    .superRefine((s, ctx) => {
        const invalid =
            s.scene.tokens.some(
                (t) =>
                    !Object.hasOwn(s.combatants, t.combatantId) ||
                    t.x >= s.scene.width ||
                    t.y >= s.scene.height,
            ) ||
            s.combat.order.some((id) => !Object.hasOwn(s.combatants, id)) ||
            Object.entries(s.combatants).some(([id, c]) => id !== c.id) ||
            new Set(s.scene.tokens.map((t) => `${t.x},${t.y}`)).size !== s.scene.tokens.length ||
            new Set(s.scene.tokens.map((t) => t.combatantId)).size !== s.scene.tokens.length ||
            s.scene.tokens.some((t) => s.scene.obstacles.some((c) => c.x === t.x && c.y === t.y)) ||
            s.scene.obstacles.some((c) => c.x >= s.scene.width || c.y >= s.scene.height) ||
            (s.combat.active && s.combat.index >= s.combat.order.length)
        if (invalid) ctx.addIssue({code: 'custom', message: 'Нарушены связи сохранения'})
    })
export const eventSchema = z
    .discriminatedUnion('type', [
        z.object({
            type: z.literal('initiative'),
            results: z.array(z.object({id: z.string(), die: z.number(), total: z.number()})),
        }),
        z.object({type: z.literal('turn'), actorId: z.string(), round: z.number()}),
        z.object({
            type: z.literal('attackRoll'),
            actorId: z.string(),
            targetId: z.string(),
            die: z.number(),
            bonus: z.number(),
            total: z.number(),
            ac: z.number(),
            hit: z.boolean(),
            critical: z.boolean(),
        }),
        z.object({
            type: z.literal('damage'),
            actorId: z.string(),
            targetId: z.string(),
            dice: z.array(z.number()),
            bonus: z.number(),
            amount: z.number(),
            beforeHp: z.number(),
            afterHp: z.number(),
            beforeTempHp: z.number(),
            afterTempHp: z.number(),
        }),
        z.object({type: z.literal('combatEnded')}),
        z.object({
            type: z.literal('movement'),
            actorId: z.string(),
            path: z.array(z.object({x: z.number(), y: z.number()})).min(2),
            costFeet: z.number().positive(),
        }),
    ])
    .and(
        z.object({
            id: z.string(),
            sequence: z.number().int().nonnegative(),
            commandId: z.string(),
            messageId: z.string(),
            timestamp: z.string(),
            sceneId: entityId.default('initial'),
        }),
    )
export const snapshotSchema = z
    .object({
        version: z.literal(1),
        state: stateSchema,
        events: z.array(eventSchema),
        name: z.string().trim().min(1).optional(),
        inactiveScenes: z.record(entityId, stateSchema).default({}),
    })
    .transform((s) => ({...s, name: s.name ?? s.state.scene.name}))
    .superRefine((s, ctx) => {
        if (
            Object.hasOwn(s.inactiveScenes, s.state.scene.id) ||
            Object.entries(s.inactiveScenes).some(
                ([id, state]) => state.id !== s.state.id || state.scene.id !== id,
            )
        )
            ctx.addIssue({code: 'custom', message: 'Нарушены связи сцен кампании'})
    })
export const actionSchema = z
    .object({
        command: commandSchema,
        beforeState: stateSchema,
        result: z.object({
            kind: z.literal('accepted'),
            nextState: stateSchema,
            events: z.array(eventSchema),
        }),
        text: z.string(),
    })
    .superRefine((a, ctx) => {
        if (
            a.result.nextState.id !== a.beforeState.id ||
            a.result.nextState.revision !== a.beforeState.revision + 1 ||
            a.command.expectedRevision !== a.beforeState.revision ||
            a.result.events.some(
                (e) => e.commandId !== a.command.id || e.messageId !== a.command.messageId,
            )
        )
            ctx.addIssue({code: 'custom', message: 'Нарушены связи действия'})
    })
