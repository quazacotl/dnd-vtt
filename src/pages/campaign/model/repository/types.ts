import type {ExecutionResult, GameCommand, GameEvent, GameState} from '../engine/types'

export interface CampaignSnapshot {
    version: 1
    state: GameState
    events: GameEvent[]
}
export interface CommittedAction {
    command: GameCommand
    beforeState: GameState
    result: Extract<ExecutionResult, {kind: 'accepted'}>
    text: string
}
export interface CampaignRepository {
    load(id: string): Promise<CampaignSnapshot | null>
    create(state: GameState): Promise<CampaignSnapshot>
    commit(action: CommittedAction): Promise<CampaignSnapshot>
    getAction(id: string): Promise<CommittedAction | null>
}
