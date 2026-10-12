import {describe, expect, it, vi} from 'vitest'
import {localParser} from './localParser'
import {createLlmParser} from './llmParser'
import {loadSettings, saveSettings, defaultSettings} from './connectionSettings'
import type {ParseContext} from './types'

const context: ParseContext = {actorId: 'hero', actors: [{id:'hero',name:'Лирам'}], targets:[{id:'goblin',name:'Гоблин'}], weapons:[{id:'sword',name:'Меч'}]}
const signal = () => new AbortController().signal
describe('Parser', () => {
    it('русская атака превращается в намерение', async () => {
        expect(await localParser.parse('Атакую гоблина мечом', context, signal())).toMatchObject({kind:'intent', actorId:'hero', targetId:'goblin', weaponId:'sword'})
    })
    it('дубликаты требуют выбора цели', async () => {
        const result = await localParser.parse('Атакую гоблина мечом', {...context, targets:[...context.targets, {id:'g2',name:'Гоблин'}]}, signal())
        expect(result.kind).toBe('clarification')
    })
    it('составное действие не выполняется частично', async () => {
        expect((await localParser.parse('Подхожу и атакую гоблина мечом', context, signal())).kind).toBe('unsupported')
    })
    it('проверяет внешний ответ и отправляет точную модель', async () => {
        let payload: unknown
        const fetcher = vi.fn<typeof fetch>(async (_, options) => {
            payload = JSON.parse(String(options?.body))
            return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({kind:'intent',actorId:'hero',targetId:'goblin',weaponId:'sword'})}}]}))
        })
        expect((await createLlmParser(defaultSettings, '', fetcher).parse('Атакую', context, signal())).kind).toBe('intent')
        expect(payload).toMatchObject({model:'Qwen3.8-27B-Abliterated'})
    })
    it.each([
        {kind:'intent',actorId:'hero',targetId:'missing',weaponId:'sword'},
        {kind:'intent',actorId:'hero',targetId:'goblin',weaponId:'sword',hp:0},
        {kind:'damage',hp:0},
    ])('отвергает опасный ответ %j', async (reply) => {
        const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(reply)}}]})))
        await expect(createLlmParser(defaultSettings, '', fetcher).parse('Атакую', context, signal())).rejects.toThrow()
    })
    it('ошибка авторизации не раскрывает ключ', async () => {
        const fetcher = vi.fn<typeof fetch>(async () => new Response('secret-key', {status:401}))
        await expect(createLlmParser(defaultSettings, 'secret-key', fetcher).parse('Атакую', context, signal())).rejects.toThrow('Авторизация')
    })
    it('повреждённые настройки безопасны, ключ сохраняется только явно', () => {
        localStorage.clear(); localStorage.setItem('dnd-connection', '{broken')
        expect(loadSettings().apiKey).toBe('')
        saveSettings(defaultSettings, 'secret'); expect(loadSettings().apiKey).toBe('')
        saveSettings({...defaultSettings,rememberKey:true}, 'secret'); expect(loadSettings().apiKey).toBe('secret')
        saveSettings(defaultSettings, 'secret'); expect(loadSettings().apiKey).toBe('')
    })
})
