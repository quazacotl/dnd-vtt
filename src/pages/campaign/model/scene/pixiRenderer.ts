import {Application, Container} from 'pixi.js'

import type {Cell, GameState} from '../engine/types'
import type {CommittedAction} from '../repository/types'
import {createFrameAnimation} from './frameAnimation'
import {drawScene} from './sceneDrawing'

export class PixiRenderer {
    private app = new Application()
    private world = new Container()
    private destroyed = false
    private mounted = false
    private state: GameState | null = null
    private observer: ResizeObserver | null = null
    private cancelFrame: (() => void) | null = null
    private selected = 'hero'
    private playing = false
    constructor(
        private onSelect: (id: string) => void,
        private onMove: (cell: Cell) => void,
    ) {}
    async mount(container: HTMLElement) {
        await this.app.init({
            resizeTo: container,
            background: '#151e18',
            antialias: true,
            resolution: Math.min(devicePixelRatio, 2),
            autoDensity: true,
            preference: 'webgl',
        })
        this.mounted = true
        if (this.destroyed) {
            this.app.destroy(true, {children: true})
            return
        }
        container.appendChild(this.app.canvas)
        this.app.stage.addChild(this.world)
        this.observer = new ResizeObserver(() => {
            if (this.state) this.draw(this.state)
        })
        this.observer.observe(container)
        if (this.state) this.draw(this.state)
    }
    sync(state: GameState) {
        this.state = state
        if (this.mounted && !this.destroyed) this.draw(state)
    }
    select(id: string) {
        this.selected = id
        if (this.state) this.sync(this.state)
    }
    private draw(state: GameState, flash?: {target: string; progress: number; amount: string}) {
        drawScene(
            this.world,
            this.app.screen,
            state,
            this.selected,
            this.onSelect,
            flash,
            this.onMove,
            !this.playing,
        )
    }
    private async tween(target: string, amount: string): Promise<void> {
        const animation = createFrameAnimation(850, (p) => {
            if (this.state) this.draw(this.state, {target, amount, progress: p})
        })
        this.cancelFrame = animation.cancel
        try {
            await animation.finished
        } finally {
            this.cancelFrame = null
        }
    }
    async play(action: CommittedAction) {
        if (this.destroyed) return
        this.playing = true
        this.sync(structuredClone(action.beforeState))
        try {
            for (const event of [...action.result.events].sort((a, b) => a.sequence - b.sequence)) {
                if (this.destroyed) return
                if (event.type === 'movement') {
                    await this.moveAlongPath(event.actorId, event.path)
                    if (this.state) this.state.combat.movementRemaining -= event.costFeet
                }
                if (event.type === 'attackRoll' && !event.hit)
                    await this.tween(event.targetId, 'Промах')
                if (event.type === 'damage') await this.tween(event.targetId, `−${event.amount}`)
            }
        } finally {
            this.playing = false
            if (!this.destroyed) this.sync(action.result.nextState)
        }
    }
    private async moveAlongPath(actorId: string, path: Cell[]): Promise<void> {
        const token = this.state?.scene.tokens.find((t) => t.combatantId === actorId)
        if (!token) return
        const animation = createFrameAnimation(Math.min(1800, (path.length - 1) * 180), (p) => {
            const segment = p * (path.length - 1)
            const index = Math.min(path.length - 2, Math.floor(segment))
            const fraction = segment - index
            token.x = path[index].x + (path[index + 1].x - path[index].x) * fraction
            token.y = path[index].y + (path[index + 1].y - path[index].y) * fraction
            if (this.state) this.draw(this.state)
        })
        this.cancelFrame = animation.cancel
        try {
            await animation.finished
            Object.assign(token, path.at(-1))
        } finally {
            this.cancelFrame = null
        }
    }
    destroy() {
        this.destroyed = true
        this.cancelFrame?.()
        this.observer?.disconnect()
        if (this.mounted) this.app.destroy(true, {children: true})
    }
}
