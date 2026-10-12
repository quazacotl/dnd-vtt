import type {DiceSource} from './types'

export const browserDice: DiceSource = {
    roll(sides) {
        const ceiling = Math.floor(0x100000000 / sides) * sides
        const data = new Uint32Array(1)
        do {crypto.getRandomValues(data)} while (data[0] >= ceiling)
        return data[0] % sides + 1
    },
}
