import {useEffect, useRef, useState, type RefObject} from 'react'
import {useStore} from 'zustand'

import type {CampaignController} from '../model/campaignStore'
import {createAnimationQueue} from '../model/scene/animationQueue'
import type {PixiRenderer} from '../model/scene/pixiRenderer'

/** Управляет асинхронным жизненным циклом PixiJS и отображением подтверждённых действий. */
export function useScene(
    container: RefObject<HTMLDivElement | null>,
    controller: CampaignController,
    selected: string,
    onSelect: (id: string) => void,
) {
    const [error, setError] = useState<string | null>(null)
    const renderer = useRef<PixiRenderer | null>(null)
    const snapshot = useStore(controller.store, (s) => s.snapshot)
    const animation = useStore(controller.store, (s) => s.animation)
    const select = useRef(onSelect)
    const selection = useRef(selected)
    useEffect(() => {
        select.current = onSelect
    }, [onSelect])
    useEffect(() => {
        selection.current = selected
        renderer.current?.select(selected)
    }, [selected])
    useEffect(() => {
        const target = container.current
        if (!target) return
        let disposed = false
        let scene: PixiRenderer | null = null
        let queue: ReturnType<typeof createAnimationQueue> | null = null
        let unsubscribe = () => {}
        const start = async () => {
            const {PixiRenderer} = await import('../model/scene/pixiRenderer')
            if (disposed) return
            scene = new PixiRenderer((id) => select.current(id))
            renderer.current = scene
            const activeScene = scene
            const activeQueue = createAnimationQueue(activeScene)
            queue = activeQueue
            await activeScene.mount(target)
            if (disposed) return
            activeScene.select(selection.current)
            let last: unknown = null
            const update = () => {
                if (disposed) return
                const s = controller.store.getState()
                if (s.animation && s.animation !== last) {
                    last = s.animation
                    void activeQueue
                        .enqueue(s.animation)
                        .catch(() => {
                            if (!disposed)
                                setError('Анимация не завершилась; показано сохранённое состояние.')
                        })
                        .finally(() => {
                            if (disposed) return
                            const current = controller.store.getState().snapshot
                            if (current) activeScene.sync(current.state)
                            controller.finishAnimation()
                        })
                } else if (!s.animation && s.snapshot) {
                    last = null
                    activeScene.sync(s.snapshot.state)
                }
            }
            unsubscribe = controller.store.subscribe(update)
            update()
        }
        void start().catch(() => {
            if (!disposed) {
                setError(
                    'Сцена недоступна. Проверьте поддержку WebGL. Результаты доступны в журнале.',
                )
                controller.finishAnimation()
            }
        })
        return () => {
            disposed = true
            unsubscribe()
            queue?.cancel()
            scene?.destroy()
            renderer.current = null
        }
    }, [container, controller])
    useEffect(() => {
        if (error && animation) {
            controller.finishAnimation()
            if (snapshot) renderer.current?.sync(snapshot.state)
        }
    }, [error, animation, controller, snapshot])
    return {error}
}
