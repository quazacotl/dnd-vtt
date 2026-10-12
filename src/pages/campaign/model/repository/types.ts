import type {ExecutionResult, GameCommand, GameEvent, GameState} from '../engine/types'

export interface CampaignSnapshot {
    version: 1
    state: GameState
    events: GameEvent[]
    name: string
    inactiveScenes: Record<string, GameState>
}
export interface CommittedAction {
    command: GameCommand
    beforeState: GameState
    result: Extract<ExecutionResult, {kind: 'accepted'}>
    text: string
}
export interface CampaignRepository {
    load(id: string): Promise<CampaignSnapshot | null>
    create(state: GameState, name?: string): Promise<CampaignSnapshot>
    list(): Promise<{id: string; name: string}[]>
    replace(snapshot: CampaignSnapshot, expectedRevision: number): Promise<CampaignSnapshot>
    importCopy(snapshot: CampaignSnapshot, actions: CommittedAction[]): Promise<CampaignSnapshot>
    commit(action: CommittedAction): Promise<CampaignSnapshot>
    getAction(id: string): Promise<CommittedAction | null>
}
