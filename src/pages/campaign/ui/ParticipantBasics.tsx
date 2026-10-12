import type {UseFormRegister} from 'react-hook-form'

import {Input} from '@/shared/ui/input'

import type {Ability} from '../model/engine/types'
import type {ParticipantForm} from '../model/participantForm'

export function ParticipantBasics({register}: {register: UseFormRegister<ParticipantForm>}) {
    return (
        <div className="editor-grid">
            <label>
                Имя
                <Input {...register('actor.name', {required: true})} />
            </label>
            <label>
                Тип
                <select {...register('actor.details.kind')}>
                    <option value="character">Персонаж</option>
                    <option value="creature">Монстр</option>
                </select>
            </label>
            <label>
                Сторона
                <select {...register('actor.side')}>
                    <option value="party">Союзник</option>
                    <option value="enemy">Противник</option>
                </select>
            </label>
            <label>
                Уровень
                <Input
                    type="number"
                    {...register('actor.details.level', {valueAsNumber: true, required: true})}
                />
            </label>
            <label>
                Класс / тип существа
                <Input {...register('actor.details.className')} />
            </label>
            <label>
                Раса / вид
                <Input {...register('actor.details.species')} />
            </label>
            {(['hp', 'maxHp', 'tempHp', 'ac', 'speed', 'dex'] as const).map((key, i) => (
                <label key={key}>
                    {
                        [
                            'HP',
                            'Максимальные HP',
                            'Временные HP',
                            'Класс брони',
                            'Скорость, футы',
                            'Бонус инициативы',
                        ][i]
                    }
                    <Input
                        type="number"
                        {...register(`actor.${key}`, {valueAsNumber: true, required: true})}
                    />
                </label>
            ))}
            {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as Ability[]).map((key) => (
                <label key={key}>
                    {key.toUpperCase()}
                    <Input
                        type="number"
                        {...register(`actor.details.abilities.${key}`, {
                            valueAsNumber: true,
                            required: true,
                        })}
                    />
                </label>
            ))}
            <label>
                Клетка X
                <Input
                    type="number"
                    {...register('position.x', {valueAsNumber: true, min: 0, required: true})}
                />
            </label>
            <label>
                Клетка Y
                <Input
                    type="number"
                    {...register('position.y', {valueAsNumber: true, min: 0, required: true})}
                />
            </label>
        </div>
    )
}
