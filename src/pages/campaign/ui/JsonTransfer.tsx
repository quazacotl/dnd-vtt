import {Button} from '@/shared/ui/button'
import {Textarea} from '@/shared/ui/textarea'

import {useJsonTransfer} from '../hooks/useJsonTransfer'
import type {CampaignController} from '../model/campaignStore'

export function JsonTransfer({
    controller,
    selected,
    disabled,
}: {
    controller: CampaignController
    selected: string
    disabled: boolean
}) {
    const transfer = useJsonTransfer(controller, selected)
    const {register} = transfer.form
    return (
        <section className="json-transfer">
            <h3>Импорт и экспорт JSON</h3>
            <p>
                Кампания включает все сцены и историю боя. Отдельная сцена переносится без истории,
                участник добавляется как новая копия.
            </p>
            <label>
                Тип данных
                <select {...register('kind')}>
                    <option value="campaign">Кампания целиком</option>
                    <option value="scene">Текущая сцена</option>
                    <option value="participant">Выбранный участник</option>
                </select>
            </label>
            <label>
                Файл JSON
                <input
                    type="file"
                    accept=".json,application/json"
                    onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) void transfer.loadFile(file)
                    }}
                />
            </label>
            <label>
                Содержимое JSON
                <Textarea rows={10} {...register('text')} />
            </label>
            <div className="settings-actions">
                <Button
                    disabled={disabled || transfer.working}
                    onClick={() => void transfer.exportJson()}
                >
                    Подготовить экспорт
                </Button>
                <Button
                    variant="secondary"
                    disabled={disabled || transfer.working}
                    onClick={transfer.download}
                >
                    Скачать JSON
                </Button>
                <Button
                    variant="outline"
                    disabled={disabled || transfer.working}
                    onClick={() => void transfer.importJson()}
                >
                    Импортировать копию
                </Button>
            </div>
            {(transfer.error || transfer.notice) && (
                <p role={transfer.error ? 'alert' : 'status'}>
                    {transfer.error ?? transfer.notice}
                </p>
            )}
        </section>
    )
}
