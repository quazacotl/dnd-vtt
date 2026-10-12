import {z} from 'zod'

import {config} from '@/shared/config'

import {resolveLlmEndpoint} from '../../utils/utils'
import {settingsSchema} from './connectionSettings'
import {llmSystemPrompt} from './llmPrompt'
import {validateResult} from './responseValidation'
import type {ConnectionSettings, IntentParser} from './types'

const responseSchema = z.object({
    choices: z.array(z.object({message: z.object({content: z.string()})})).min(1),
})
/** Создаёт адаптер предполагаемого OpenAI-совместимого API без собственного backend. */
export function createLlmParser(
    settings: ConnectionSettings,
    apiKey: string,
    fetcher: typeof fetch = fetch,
): IntentParser {
    const valid = settingsSchema.parse(settings)
    return {
        async parse(text, context, signal) {
            const timeoutController = new AbortController()
            const timer = setTimeout(() => timeoutController.abort(), config.requestTimeoutMs)
            const timeout = timeoutController.signal
            const combined = AbortSignal.any([signal, timeout])
            try {
                const endpoint = resolveLlmEndpoint(valid.baseUrl)
                let response: Response
                try {
                    response = await fetcher(endpoint, {
                        method: 'POST',
                        signal: combined,
                        headers: {
                            'Content-Type': 'application/json',
                            ...(apiKey ? {Authorization: `Bearer ${apiKey}`} : {}),
                        },
                        body: JSON.stringify({
                            model: valid.model,
                            stream: false,
                            temperature: 0,
                            messages: [
                                {
                                    role: 'system',
                                    content: llmSystemPrompt,
                                },
                                {role: 'user', content: JSON.stringify({text, context})},
                            ],
                        }),
                    })
                    combined.throwIfAborted()
                } catch {
                    if (signal.aborted) throw Error('Запрос отменён.')
                    if (timeout.aborted) throw Error('Модель не ответила за 30 секунд.')
                    throw Error(
                        import.meta.env.DEV
                            ? 'Сетевая ошибка. Проверьте, что Vite запущен и сервис модели доступен.'
                            : 'Сетевая ошибка. Проверьте адрес сервиса и разрешение CORS для браузера.',
                    )
                }
                if (response.status === 401 || response.status === 403)
                    throw Error('Авторизация не прошла. Проверьте ключ в настройках.')
                if (!response.ok) throw Error(`Сервис модели вернул HTTP ${response.status}.`)
                try {
                    const body = responseSchema.parse(await response.json())
                    combined.throwIfAborted()
                    const content = body.choices[0].message.content
                        .trim()
                        .replace(/^```(?:json)?\s*/, '')
                        .replace(/\s*```$/, '')
                    return validateResult(JSON.parse(content) as unknown, context)
                } catch {
                    throw Error('Ответ модели не прошёл проверку. Игровое состояние не изменено.')
                }
            } finally {
                clearTimeout(timer)
            }
        },
    }
}
