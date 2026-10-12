import {Button} from '@/shared/ui/button'
import {Input} from '@/shared/ui/input'
import {Textarea} from '@/shared/ui/textarea'

import {useParticipantEditor} from '../hooks/useParticipantEditor'
import type {Cell, Combatant} from '../model/engine/types'
import {ParticipantBasics} from './ParticipantBasics'

export function ParticipantEditor({
    actor,
    position,
    disabled,
    onSave,
    onCancel,
}: {
    actor: Combatant
    position: Cell
    disabled: boolean
    onSave: (actor: Combatant, position: Cell) => Promise<void>
    onCancel: () => void
}) {
    const {register, weapons, spells, error, errors, submit} = useParticipantEditor(
        actor,
        position,
        onSave,
    )
    return (
        <form className="participant-editor" onSubmit={submit}>
            <h3>Редактор: {actor.name}</h3>
            <ParticipantBasics register={register} />
            <h4>Оружие и атаки</h4>
            {weapons.fields.map((field, index) => (
                <div className="weapon-editor" key={field.id}>
                    <label>
                        Атака
                        <Input {...register(`actor.weapons.${index}.name`, {required: true})} />
                    </label>
                    {(['bonus', 'diceCount', 'damageDie', 'damageBonus', 'range'] as const).map(
                        (key, i) => (
                            <label key={key}>
                                {['Бонус', 'Костей', 'Граней', 'Бонус урона', 'Дальность'][i]}
                                <Input
                                    type="number"
                                    {...register(`actor.weapons.${index}.${key}`, {
                                        valueAsNumber: true,
                                        required: key !== 'diceCount',
                                    })}
                                />
                            </label>
                        ),
                    )}
                    <Button type="button" variant="ghost" onClick={() => weapons.remove(index)}>
                        Убрать атаку
                    </Button>
                </div>
            ))}
            <Button
                type="button"
                variant="secondary"
                onClick={() =>
                    weapons.append({
                        id: crypto.randomUUID(),
                        name: 'Новая атака',
                        bonus: 0,
                        diceCount: 1,
                        damageDie: 6,
                        damageBonus: 0,
                        range: 5,
                    })
                }
            >
                Добавить атаку
            </Button>
            <div className="editor-text-grid">
                {(
                    [
                        'skillsText',
                        'savesText',
                        'inventoryText',
                        'featuresText',
                        'conditionsText',
                    ] as const
                ).map((key, i) => (
                    <label key={key}>
                        {
                            [
                                'Навыки — название: бонус',
                                'Спасброски — название: бонус',
                                'Инвентарь — название: количество',
                                'Особенности — по одной на строку',
                                'Состояния — по одному на строку',
                            ][i]
                        }
                        <Textarea {...register(key)} />
                    </label>
                ))}
                <label>
                    Заметки, предыстория и описание
                    <Textarea {...register('actor.details.notes')} />
                </label>
            </div>
            <h4>Заклинания (справочные записи)</h4>
            {spells.fields.map((field, index) => (
                <div className="spell-editor" key={field.id}>
                    <label>
                        Заклинание
                        <Input
                            {...register(`actor.details.spells.${index}.name`, {required: true})}
                        />
                    </label>
                    <label>
                        Уровень
                        <Input
                            type="number"
                            {...register(`actor.details.spells.${index}.level`, {
                                valueAsNumber: true,
                                required: true,
                            })}
                        />
                    </label>
                    <label>
                        Описание
                        <Textarea {...register(`actor.details.spells.${index}.description`)} />
                    </label>
                    <Button type="button" variant="ghost" onClick={() => spells.remove(index)}>
                        Убрать заклинание
                    </Button>
                </div>
            ))}
            <Button
                type="button"
                variant="secondary"
                onClick={() => spells.append({name: 'Новое заклинание', level: 0, description: ''})}
            >
                Добавить заклинание
            </Button>
            {(error || Object.keys(errors).length > 0) && (
                <p role="alert">{error ?? 'Проверьте обязательные поля.'}</p>
            )}
            <div className="settings-actions">
                <Button type="submit" disabled={disabled}>
                    Сохранить участника
                </Button>
                <Button type="button" variant="ghost" onClick={onCancel}>
                    Отмена
                </Button>
            </div>
        </form>
    )
}
