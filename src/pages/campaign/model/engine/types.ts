export interface Weapon {id: string; name: string; bonus: number; damageDie: number; damageBonus: number; range: number}
export interface Combatant {id: string; name: string; side: 'party' | 'enemy'; hp: number; maxHp: number; tempHp: number; ac: number; dex: number; weapons: Weapon[]}
export interface GameState {
    id: string
    revision: number
    ruleset: '2014'
    scene: {name: string; width: number; height: number; tokens: {id: string; combatantId: string; x: number; y: number}[]}
    combatants: Record<string, Combatant>
    combat: {active: boolean; round: number; order: string[]; index: number; actionAvailable: boolean}
}
interface CommandBase {id: string; messageId: string; expectedRevision: number}
export type GameCommand = CommandBase & (
    {type: 'start'} | {type: 'end'} |
    {type: 'attack'; actorId: string; targetId: string; weaponId: string}
)
export interface DiceSource {roll(sides: number): number}
interface EventBase {id: string; sequence: number; commandId: string; messageId: string; timestamp: string}
export type GameEvent = EventBase & (
    {type: 'initiative'; results: {id: string; die: number; total: number}[]} |
    {type: 'turn'; actorId: string; round: number} |
    {type: 'attackRoll'; actorId: string; targetId: string; die: number; bonus: number; total: number; ac: number; hit: boolean; critical: boolean} |
    {type: 'damage'; actorId: string; targetId: string; dice: number[]; bonus: number; amount: number; beforeHp: number; afterHp: number; beforeTempHp: number; afterTempHp: number} |
    {type: 'combatEnded'}
)
export type ExecutionResult = {kind: 'accepted'; nextState: GameState; events: GameEvent[]} | {kind: 'rejected'; code: string; message: string}
