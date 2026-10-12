import {z} from 'zod'

import {config} from '@/shared/config'

import type {ConnectionSettings} from './types'

export const defaultSettings: ConnectionSettings = {
    baseUrl: config.apiBaseUrl,
    model: config.model,
    parserMode: 'local',
    rememberKey: false,
}
export const settingsSchema = z.object({
    baseUrl: z.url().refine((v) => /^https?:\/\//i.test(v), 'Нужен http/https URL'),
    model: z.string().trim().min(1),
    parserMode: z.enum(['local', 'llm']),
    rememberKey: z.boolean(),
})
const storageKey = 'dnd-connection'
/** Загружает валидные настройки; повреждённая запись не мешает локальному режиму. */
export function loadSettings(): {settings: ConnectionSettings; apiKey: string} {
    try {
        const raw: unknown = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
        const saved = z.object({settings: settingsSchema, apiKey: z.string().optional()}).parse(raw)
        return {
            settings: saved.settings,
            apiKey: saved.settings.rememberKey ? (saved.apiKey ?? '') : '',
        }
    } catch {
        return {settings: {...defaultSettings}, apiKey: ''}
    }
}
/** Сохраняет ключ только по явно включённой настройке пользователя. */
export function saveSettings(settings: ConnectionSettings, apiKey: string): void {
    const valid = settingsSchema.parse(settings)
    localStorage.setItem(
        storageKey,
        JSON.stringify({settings: valid, ...(valid.rememberKey ? {apiKey} : {})}),
    )
}
