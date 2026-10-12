import {describe, expect, it} from 'vitest'

import {resolveLlmEndpoint} from './utils'

describe('маршрут запросов LLM', () => {
    it.each(['https://ai.hexteam.tech/v1', 'https://ai.hexteam.tech/v1/'])(
        'использует Vite proxy для %s в dev',
        (base) => {
            expect(resolveLlmEndpoint(base, true)).toBe('/llm-api/chat/completions')
        },
    )
    it('сохраняет прямой URL для production', () => {
        expect(resolveLlmEndpoint('https://ai.hexteam.tech/v1', false)).toBe(
            'https://ai.hexteam.tech/v1/chat/completions',
        )
    })
    it('не перенаправляет ключ для другого сервиса в фиксированный proxy', () => {
        expect(resolveLlmEndpoint('http://localhost:9000/v1', true)).toBe(
            'http://localhost:9000/v1/chat/completions',
        )
    })
})
