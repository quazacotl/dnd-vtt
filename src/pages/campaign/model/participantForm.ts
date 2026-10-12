import type {Cell, Combatant} from './engine/types'

export interface ParticipantForm {
    actor: Combatant
    position: Cell
    skillsText: string
    savesText: string
    inventoryText: string
    featuresText: string
    conditionsText: string
}
