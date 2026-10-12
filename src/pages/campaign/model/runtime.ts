import {createCampaignController} from './campaignStore'
import {browserDice} from './engine/dice'
import {loadSettings} from './parser/connectionSettings'
import {createLlmParser} from './parser/llmParser'
import {localParser} from './parser/localParser'
import {createRepository} from './repository/indexedDb'

const saved = loadSettings()
export const campaignController = createCampaignController({
    repository: createRepository(),
    dice: browserDice,
    parser:
        saved.settings.parserMode === 'llm'
            ? createLlmParser(saved.settings, saved.apiKey)
            : localParser,
})
