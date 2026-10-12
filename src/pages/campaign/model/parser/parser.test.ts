import {describe, expect, it, vi} from 'vitest'

import {loadSettings, saveSettings, defaultSettings} from './connectionSettings'
import {createLlmParser} from './llmParser'
import {localParser} from './localParser'
import type {ParseContext} from './types'

const context: ParseContext = {
    actorId: 'hero',
    actors: [{id: 'hero', name: 'Лирам'}],
    targets: [{id: 'goblin', name: 'Гоблин'}],
    weapons: [{id: 'sword', name: 'Меч'}],
}
const signal = () => new AbortController().signal
describe('Parser', () => {
    it.each([
        'Не атакую гоблина мечом',
        'Атакую гоблина мечом и отхожу',
        'Атакую гоблина мечом дважды',
        'Атакую гоблина луком',
    ])('не исполняет неподдерживаемое сообщение: %s', async (text) => {
        expect((await localParser.parse(text, context, signal())).kind).toBe('unsupported')
    })
    it('таймаут и отмена не возвращают команду', async () => {
        vi.useFakeTimers()
        const fetcher: typeof fetch = async (_, options) =>
            new Promise((_, reject) => {
                options?.signal?.addEventListener('abort', () => reject(Error('abort')))
            })
        const request = createLlmParser(defaultSettings, '', fetcher).parse(
            'Атакую',
            context,
            signal(),
        )
        await Promise.all([
            expect(request).rejects.toThrow('30 секунд'),
            vi.advanceTimersByTimeAsync(30_001),
        ])
        vi.useRealTimers()
        const abort = new AbortController()
        const cancelled = createLlmParser(defaultSettings, '', fetcher).parse(
            'Атакую',
            context,
            abort.signal,
        )
        abort.abort()
        await expect(cancelled).rejects.toThrow('Запрос отменён')
    })
    it('русская атака превращается в намерение', async () => {
        expect(await localParser.parse('Атакую гоблина мечом', context, signal())).toMatchObject({
            kind: 'intent',
            actorId: 'hero',
            targetId: 'goblin',
            weaponId: 'sword',
        })
    })
    it('дубликаты требуют выбора цели', async () => {
        const result = await localParser.parse(
            'Атакую гоблина мечом',
            {...context, targets: [...context.targets, {id: 'g2', name: 'Гоблин'}]},
            signal(),
        )
        expect(result.kind).toBe('clarification')
    })
    it('составное действие не выполняется частично', async () => {
        expect(
            (await localParser.parse('Подхожу и атакую гоблина мечом', context, signal())).kind,
        ).toBe('unsupported')
    })
    it('проверяет внешний ответ и отправляет точную модель', async () => {
        let payload: unknown
        let endpoint = ''
        const fetcher = vi.fn<typeof fetch>(async (url, options) => {
            if (typeof url !== 'string') throw Error('Нужен строковый endpoint')
            endpoint = url
            if (typeof options?.body !== 'string') throw Error('Нужен JSON body')
            payload = JSON.parse(options.body)
            return new Response(
                JSON.stringify({
                    choices: [
                        {
                            message: {
                                content: JSON.stringify({
                                    kind: 'intent',
                                    actorId: 'hero',
                                    targetId: 'goblin',
                                    weaponId: 'sword',
                                }),
                            },
                        },
                    ],
                }),
            )
        })
        expect(
            (await createLlmParser(defaultSettings, '', fetcher).parse('Атакую', context, signal()))
                .kind,
        ).toBe('intent')
        expect(payload).toMatchObject({model: 'Qwen3.8-27B-Abliterated'})
        expect(endpoint).toBe('/llm-api/chat/completions')
    })
    it.each([
        {kind: 'intent', actorId: 'hero', targetId: 'missing', weaponId: 'sword'},
        {kind: 'intent', actorId: 'hero', targetId: 'goblin', weaponId: 'sword', hp: 0},
        {kind: 'damage', hp: 0},
    ])('отвергает опасный ответ %j', async (reply) => {
        const fetcher = vi.fn<typeof fetch>(
            async () =>
                new Response(
                    JSON.stringify({choices: [{message: {content: JSON.stringify(reply)}}]}),
                ),
        )
        await expect(
            createLlmParser(defaultSettings, '', fetcher).parse('Атакую', context, signal()),
        ).rejects.toThrow('Ответ модели не прошёл проверку')
    })
    it('ошибка авторизации не раскрывает ключ', async () => {
        const fetcher = vi.fn<typeof fetch>(async () => new Response('secret-key', {status: 401}))
        await expect(
            createLlmParser(defaultSettings, 'secret-key', fetcher).parse(
                'Атакую',
                context,
                signal(),
            ),
        ).rejects.toThrow('Авторизация')
    })
    it('повреждённые настройки безопасны, ключ сохраняется только явно', () => {
        localStorage.clear()
        localStorage.setItem('dnd-connection', '{broken')
        expect(loadSettings().apiKey).toBe('')
        saveSettings(defaultSettings, 'secret')
        expect(loadSettings().apiKey).toBe('')
        saveSettings({...defaultSettings, rememberKey: true}, 'secret')
        expect(loadSettings().apiKey).toBe('secret')
        saveSettings(defaultSettings, 'secret')
        expect(loadSettings().apiKey).toBe('')
    })
})
