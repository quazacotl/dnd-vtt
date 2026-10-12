import {useState} from 'react'

import type {CampaignController} from '../model/campaignStore'
import {loadSettings, saveSettings} from '../model/parser/connectionSettings'
import {createLlmParser} from '../model/parser/llmParser'
import {localParser} from '../model/parser/localParser'
import type {ConnectionSettings} from '../model/parser/types'

/** Применяет настройки адаптера и отменяет запросы предыдущего подключения. */
export function useConnectionSettings(controller: CampaignController) {
    const [connection, setConnection] = useState(loadSettings)
    const [error, setError] = useState<string | null>(null)
    const apply = (settings: ConnectionSettings, apiKey: string) => {
        try {
            saveSettings(settings, apiKey)
            controller.setParser(
                settings.parserMode === 'llm' ? createLlmParser(settings, apiKey) : localParser,
            )
            setConnection({settings, apiKey})
            setError(null)
            return true
        } catch {
            setError('Не удалось сохранить настройки. Проверьте URL и доступность localStorage.')
            return false
        }
    }
    return {connection, apply, error}
}
