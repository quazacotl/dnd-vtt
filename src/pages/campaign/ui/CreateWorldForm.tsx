import {useForm} from 'react-hook-form'

import {Button} from '@/shared/ui/button'
import {Input} from '@/shared/ui/input'

export function CreateWorldForm({
    kind,
    disabled,
    onCreate,
}: {
    kind: 'campaign' | 'scene'
    disabled: boolean
    onCreate: (name: string, width: number, height: number) => Promise<void>
}) {
    const {
        register,
        handleSubmit,
        reset,
        formState: {errors},
    } = useForm<{name: string; width: number; height: number}>({
        defaultValues: {name: '', width: 12, height: 10},
    })
    const submit = handleSubmit(async (data) => {
        await onCreate(data.name, data.width, data.height)
        reset()
    })
    return (
        <form className="world-create" onSubmit={submit}>
            <label>
                Название {kind === 'campaign' ? 'кампании' : 'сцены'}
                <Input
                    {...register('name', {
                        required: true,
                        validate: (v) => !!v.trim(),
                        maxLength: 80,
                    })}
                />
            </label>
            <label>
                Ширина карты
                <Input
                    type="number"
                    {...register('width', {valueAsNumber: true, min: 4, max: 50, required: true})}
                />
            </label>
            <label>
                Высота карты
                <Input
                    type="number"
                    {...register('height', {valueAsNumber: true, min: 4, max: 50, required: true})}
                />
            </label>
            <Button disabled={disabled} type="submit">
                Создать {kind === 'campaign' ? 'кампанию' : 'сцену'}
            </Button>
            {Object.keys(errors).length > 0 && (
                <p role="alert">Укажите название и размеры карты от 4 до 50.</p>
            )}
        </form>
    )
}
