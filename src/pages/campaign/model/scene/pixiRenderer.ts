import {Application, Container} from 'pixi.js'

import type {GameState} from '../engine/types'
import type {CommittedAction} from '../repository/types'
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
    constructor(private onSelect: (id: string) => void) {}
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
        drawScene(this.world, this.app.screen, state, this.selected, this.onSelect, flash)
    }
    private tween(target: string, amount: string): Promise<void> {
        return new Promise((resolve) => {
            const start = performance.now()
            let frame = 0
            const finish = () => {
                cancelAnimationFrame(frame)
                this.cancelFrame = null
                resolve()
            }
            this.cancelFrame = finish
            const tick = (now: number) => {
                if (this.destroyed) {
                    finish()
                    return
                }
                const p = Math.min(1, (now - start) / 850)
                if (this.state) this.draw(this.state, {target, amount, progress: p})
                if (p >= 1) finish()
                else frame = requestAnimationFrame(tick)
            }
            frame = requestAnimationFrame(tick)
        })
    }
    async play(action: CommittedAction) {
        if (this.destroyed) return
        this.sync(action.beforeState)
        for (const event of [...action.result.events].sort((a, b) => a.sequence - b.sequence)) {
            if (this.destroyed) return
            if (event.type === 'attackRoll' && !event.hit)
                await this.tween(event.targetId, 'Промах')
            if (event.type === 'damage') await this.tween(event.targetId, `−${event.amount}`)
        }
        this.sync(action.result.nextState)
    }
    destroy() {
        this.destroyed = true
        this.cancelFrame?.()
        this.observer?.disconnect()
        if (this.mounted) this.app.destroy(true, {children: true})
    }
}
