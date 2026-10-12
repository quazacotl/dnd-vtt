import {useEffect} from 'react'
import {useStore} from 'zustand'

import type {CampaignController} from '../model/campaignStore'

/** Загружает кампанию и подписывает экран на самостоятельный сценарий. */
export function useCampaign(controller: CampaignController, id: string, sceneId?: string | null) {
    useEffect(() => {
        const current = controller.store.getState()
        if (
            current.status === 'ready' &&
            current.snapshot?.state.id === id &&
            (!sceneId || current.snapshot.state.scene.id === sceneId)
        )
            return () => controller.cancelRequest()
        let active = true
        void controller
            .load(id)
            .then(async () => {
                const snapshot = controller.store.getState().snapshot
                if (
                    active &&
                    snapshot?.state.id === id &&
                    sceneId &&
                    snapshot &&
                    snapshot.state.scene.id !== sceneId &&
                    Object.hasOwn(snapshot.inactiveScenes, sceneId)
                )
                    await controller.switchScene(sceneId)
            })
            .catch(() => {})
        return () => {
            active = false
            controller.cancelRequest()
        }
    }, [controller, id, sceneId])
    const snapshot = useStore(controller.store, (s) => s.snapshot)
    const status = useStore(controller.store, (s) => s.status)
    const busy = useStore(
        controller.store,
        (s) => s.status === 'loading' || s.busy || !!s.animation || !!s.pendingSave,
    )
    return {snapshot, status, busy}
}
