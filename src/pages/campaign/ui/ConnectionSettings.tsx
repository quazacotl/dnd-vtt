import {useState} from 'react'
import {useForm} from 'react-hook-form'

import {Button} from '@/shared/ui/button'
import {Input} from '@/shared/ui/input'

import {createStarterState} from '../model/engine/starter'
import {createLlmParser} from '../model/parser/llmParser'
import type {ConnectionSettings as Settings} from '../model/parser/types'
import {buildContext} from '../utils/utils'

interface Props {
    settings: Settings
    apiKey: string
    onSave: (settings: Settings, key: string) => boolean
    onClose: () => void
    error: string | null
}
export function ConnectionSettings({settings, apiKey, onSave, onClose, error}: Props) {
    const {
        register,
        handleSubmit,
        getValues,
        formState: {errors},
    } = useForm<Settings & {apiKey: string}>({defaultValues: {...settings, apiKey}})
    const [status, setStatus] = useState<string | null>(null)
    const [checking, setChecking] = useState(false)
    const submit = handleSubmit(({apiKey: key, ...next}) => {
        if (onSave(next, key)) onClose()
    })
    const check = async () => {
        const {apiKey: key, ...next} = getValues()
        setChecking(true)
        setStatus(null)
        try {
            const result = await createLlmParser(next, key).parse(
                'Атакую гоблина мечом',
                buildContext(createStarterState()),
                new AbortController().signal,
            )
            setStatus(
                result.kind === 'intent'
                    ? 'Подключение работает. Модель вернула валидное намерение.'
                    : 'Сервис ответил, но запросил уточнение или не распознал действие.',
            )
        } catch (e) {
            setStatus(e instanceof Error ? e.message : 'Ошибка подключения.')
        } finally {
            setChecking(false)
        }
    }
    return (
        <section className="settings-panel" aria-label="Настройки подключения">
            <div>
                <h2>Подключение модели</h2>
                <p>Запрос идёт напрямую из браузера. Правила рассчитываются локально.</p>
            </div>
            <form onSubmit={submit}>
                <label htmlFor="parser-mode">
                    Интерпретатор
                    <select id="parser-mode" {...register('parserMode')}>
                        <option value="local">Локальный parser</option>
                        <option value="llm">Qwen / совместимый API</option>
                    </select>
                </label>
                <label htmlFor="api-url">
                    Base URL
                    <Input
                        id="api-url"
                        {...register('baseUrl', {
                            required: true,
                            validate: (v) => /^https?:\/\//i.test(v) || 'Нужен HTTP/HTTPS URL',
                        })}
                    />
                    {errors.baseUrl && <small role="alert">Проверьте адрес API.</small>}
                </label>
                <label htmlFor="model-name">
                    Модель
                    <Input id="model-name" {...register('model', {required: true})} />
                </label>
                <label htmlFor="api-key">
                    API-ключ
                    <Input
                        id="api-key"
                        type="password"
                        autoComplete="off"
                        {...register('apiKey')}
                    />
                </label>
                <label className="checkbox-label">
                    <input type="checkbox" {...register('rememberKey')} /> Сохранять ключ в этом
                    браузере
                </label>
                <p className="muted">
                    Без этой опции ключ действует до закрытия или перезагрузки страницы.
                </p>
                {(status || error) && (
                    <output className="connection-status">{error ?? status}</output>
                )}
                <div className="settings-actions">
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={checking}
                        onClick={() => void check()}
                    >
                        {checking ? 'Проверяем…' : 'Проверить API'}
                    </Button>
                    <Button type="submit">Применить</Button>
                    <Button type="button" variant="ghost" onClick={onClose}>
                        Закрыть
                    </Button>
                </div>
            </form>
        </section>
    )
}
