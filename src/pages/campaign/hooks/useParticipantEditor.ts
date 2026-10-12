import {useState} from 'react'
import {useFieldArray, useForm} from 'react-hook-form'

import type {Cell, Combatant} from '../model/engine/types'
import {newParticipant} from '../model/management'
import type {ParticipantForm} from '../model/participantForm'
import {combatantSchema} from '../model/repository/validation'
import {formatNamedNumbers, parseNamedNumbers, parseNamedEntries} from '../utils/utils'

/** Ведёт черновик участника и проверяет его перед сохранением. */
export function useParticipantEditor(
    actor: Combatant,
    position: Cell,
    onSave: (actor: Combatant, position: Cell) => Promise<void>,
) {
    const initial = structuredClone(actor)
    initial.details ??= newParticipant(
        actor.side === 'party' ? 'character' : 'creature',
        actor.name,
    ).details!
    initial.weapons = initial.weapons.map((w) => ({...w, diceCount: w.diceCount ?? 1}))
    const {
        register,
        control,
        handleSubmit,
        formState: {errors},
    } = useForm<ParticipantForm>({
        defaultValues: {
            actor: initial,
            position,
            skillsText: formatNamedNumbers(initial.details.skills),
            savesText: formatNamedNumbers(initial.details.saves),
            inventoryText: initial.details.inventory.map((i) => `${i.name}: ${i.count}`).join('\n'),
            featuresText: initial.details.features.join('\n'),
            conditionsText: initial.details.conditions.join('\n'),
        },
    })
    const weapons = useFieldArray({control, name: 'actor.weapons'})
    const spells = useFieldArray({control, name: 'actor.details.spells'})
    const [error, setError] = useState<string | null>(null)
    const submit = handleSubmit(async (data) => {
        try {
            const details = data.actor.details!
            details.skills = parseNamedNumbers(data.skillsText)
            details.saves = parseNamedNumbers(data.savesText)
            details.inventory = parseNamedEntries(data.inventoryText).map(([name, count]) => ({
                name,
                count,
            }))
            details.features = data.featuresText
                .split('\n')
                .map((v) => v.trim())
                .filter(Boolean)
            details.conditions = data.conditionsText
                .split('\n')
                .map((v) => v.trim())
                .filter(Boolean)
            const valid = combatantSchema.safeParse(data.actor)
            if (!valid.success) throw Error(valid.error.issues.map((i) => i.message).join('; '))
            setError(null)
            await onSave(valid.data, data.position)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Проверьте характеристики.')
        }
    })
    return {register, weapons, spells, error, errors, submit}
}
