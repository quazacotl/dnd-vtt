export interface Weapon {
    id: string
    name: string
    bonus: number
    damageDie: number
    damageBonus: number
    range: number
    diceCount?: number
}
export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'
export interface CharacterDetails {
    kind: 'character' | 'creature'
    level: number
    className: string
    species: string
    abilities: Record<Ability, number>
    skills: Record<string, number>
    saves: Record<string, number>
    inventory: {name: string; count: number}[]
    spells: {name: string; level: number; description: string}[]
    features: string[]
    conditions: string[]
    notes: string
}
export interface Combatant {
    id: string
    name: string
    side: 'party' | 'enemy'
    hp: number
    maxHp: number
    tempHp: number
    ac: number
    dex: number
    speed: number
    weapons: Weapon[]
    details?: CharacterDetails
}
export interface GameState {
    id: string
    revision: number
    ruleset: '2014'
    scene: {
        id: string
        name: string
        width: number
        height: number
        obstacles: Cell[]
        tokens: {id: string; combatantId: string; x: number; y: number}[]
    }
    combatants: Record<string, Combatant>
    combat: {
        active: boolean
        round: number
        order: string[]
        index: number
        actionAvailable: boolean
        movementRemaining: number
    }
}
interface CommandBase {
    id: string
    messageId: string
    expectedRevision: number
}
export type GameCommand = CommandBase &
    (
        | {type: 'start'}
        | {type: 'end'}
        | {type: 'stop'}
        | {type: 'attack' | 'approachAttack'; actorId: string; targetId: string; weaponId: string}
        | {type: 'move'; actorId: string; destination: Cell}
    )
export interface DiceSource {
    roll(sides: number): number
}
interface EventBase {
    sceneId: string
    id: string
    sequence: number
    commandId: string
    messageId: string
    timestamp: string
}
export type GameEvent = EventBase &
    (
        | {type: 'initiative'; results: {id: string; die: number; total: number}[]}
        | {type: 'turn'; actorId: string; round: number}
        | {
              type: 'attackRoll'
              actorId: string
              targetId: string
              die: number
              bonus: number
              total: number
              ac: number
              hit: boolean
              critical: boolean
          }
        | {
              type: 'damage'
              actorId: string
              targetId: string
              dice: number[]
              bonus: number
              amount: number
              beforeHp: number
              afterHp: number
              beforeTempHp: number
              afterTempHp: number
          }
        | {type: 'combatEnded'}
        | {type: 'movement'; actorId: string; path: Cell[]; costFeet: number}
    )
export type ExecutionResult =
    | {kind: 'accepted'; nextState: GameState; events: GameEvent[]}
    | {kind: 'rejected'; code: string; message: string}
export interface Cell {
    x: number
    y: number
}
