import {Container, Graphics, Text} from 'pixi.js'

import {reachableCells} from '../engine/movement'
import type {Cell, GameState} from '../engine/types'

/** Отрисовывает снимок игры; оформление не изменяет состояние. */
export function drawScene(
    world: Container,
    screen: {width: number; height: number},
    state: GameState,
    selected: string,
    onSelect: (id: string) => void,
    flash?: {target: string; progress: number; amount: string},
    onMove?: (cell: Cell) => void,
    interactive = true,
) {
    for (const child of world.removeChildren()) child.destroy({children: true})
    const cell = 58
    const width = state.scene.width * cell
    const height = state.scene.height * cell
    const scale = Math.min((screen.width - 48) / width, (screen.height - 64) / height)
    world.scale.set(Math.max(0.15, scale))
    world.position.set((screen.width - width * scale) / 2, (screen.height - height * scale) / 2)
    const floor = new Graphics()
        .roundRect(-8, -8, width + 16, height + 16, 10)
        .fill('#26392c')
        .stroke({color: 0x7d7958, width: 2, alpha: 0.5})
    for (let y = 0; y < state.scene.height; y++)
        for (let x = 0; x < state.scene.width; x++) {
            const n = (x * 31 + y * 17) % 9
            floor
                .rect(x * cell, y * cell, cell - 1, cell - 1)
                .fill(n < 3 ? '#344133' : n < 6 ? '#303a30' : '#2d372e')
            if (n === 0)
                floor.circle(x * cell + 15, y * cell + 18, 4).fill({color: 0x678056, alpha: 0.22})
        }
    world.addChild(floor)
    if (interactive) {
        floor.eventMode = 'static'
        floor.cursor = 'crosshair'
        floor.on('pointertap', (event) => {
            const p = event.getLocalPosition(world)
            onMove?.({x: Math.floor(p.x / cell), y: Math.floor(p.y / cell)})
        })
        const range = new Graphics()
        for (const c of reachableCells(state, selected))
            range
                .rect(c.x * cell + 2, c.y * cell + 2, cell - 4, cell - 4)
                .fill({color: 0x9acb98, alpha: 0.13})
                .stroke({color: 0x83b17b, alpha: 0.3, width: 1})
        world.addChild(range)
    }
    const ruins = new Graphics()
    for (const {x, y} of state.scene.obstacles) {
        ruins
            .roundRect(x * cell + 5, y * cell + 5, cell - 10, cell - 10, 6)
            .fill('#69735f')
            .stroke({color: 0x97977b, width: 2})
        ruins
            .moveTo(x * cell + 12, y * cell + 27)
            .lineTo(x * cell + 45, y * cell + 27)
            .stroke({color: 0x414d3d, width: 2})
    }
    world.addChild(ruins)
    for (let x = 0; x < state.scene.width; x++) {
        const label = new Text({text: String(x), style: {fontSize: 11, fill: '#9baf8e'}})
        label.anchor.set(0.5)
        label.position.set(x * cell + 29, -18)
        world.addChild(label)
    }
    for (let y = 0; y < state.scene.height; y++) {
        const label = new Text({text: String(y), style: {fontSize: 11, fill: '#9baf8e'}})
        label.anchor.set(0.5)
        label.position.set(-18, y * cell + 29)
        world.addChild(label)
    }
    const active = state.combat.active ? state.combat.order[state.combat.index] : null
    for (const token of state.scene.tokens) {
        const c = state.combatants[token.combatantId]
        const unit = new Container()
        unit.position.set(token.x * cell + 29, token.y * cell + 29)
        if (active === c.id)
            unit.addChild(
                new Graphics().circle(0, 0, 28).stroke({color: 0xd7b778, width: 2, alpha: 0.9}),
            )
        if (selected === c.id)
            unit.addChild(
                new Graphics().circle(0, 0, 31).stroke({color: 0x9ec5af, width: 1, alpha: 0.6}),
            )
        const body = new Graphics()
            .circle(0, 0, 23)
            .fill(c.side === 'party' ? '#497665' : '#8a5144')
            .stroke({color: c.side === 'party' ? 0xa9c9b5 : 0xd69477, width: 2})
        body.alpha = c.hp > 0 ? 1 : 0.35
        unit.addChild(body)
        const letter = new Text({
            text: c.name.slice(0, 1).toUpperCase(),
            style: {fontFamily: 'Georgia', fontSize: 25, fill: '#f3eee1', fontWeight: 'bold'},
        })
        letter.anchor.set(0.5)
        unit.addChild(letter)
        const hp = new Graphics()
            .roundRect(-22, 31, 44, 5, 2)
            .fill('#141b14')
            .roundRect(-22, 31, (44 * c.hp) / c.maxHp, 5, 2)
            .fill(c.side === 'party' ? '#96bd95' : '#cf8c71')
        unit.addChild(hp)
        const label = new Text({
            text: c.name,
            style: {
                fontFamily: 'Segoe UI',
                fontSize: 12,
                fill: '#e5e5d2',
                stroke: {color: '#172019', width: 3},
            },
        })
        label.anchor.set(0.5)
        label.position.y = 49
        unit.addChild(label)
        unit.eventMode = 'static'
        unit.cursor = 'pointer'
        unit.on('pointertap', () => onSelect(c.id))
        world.addChild(unit)
        if (flash?.target === c.id) {
            const ring = new Graphics()
                .circle(0, 0, 25 + flash.progress * 22)
                .stroke({color: 0xe1b782, width: 3, alpha: 1 - flash.progress})
            unit.addChild(ring)
            const number = new Text({
                text: flash.amount,
                style: {
                    fontFamily: 'Georgia',
                    fontSize: 27,
                    fill: '#f6d7a3',
                    fontWeight: 'bold',
                    stroke: {color: '#241a14', width: 3},
                },
            })
            number.anchor.set(0.5)
            number.y = -30 - flash.progress * 35
            number.alpha = 1 - flash.progress
            unit.addChild(number)
        }
    }
}
