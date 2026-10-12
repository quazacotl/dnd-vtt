import {useEffect} from 'react'
import {useStore} from 'zustand'

import type {CampaignController} from '../model/campaignStore'

/** Загружает кампанию и подписывает экран на самостоятельный сценарий. */
export function useCampaign(controller: CampaignController, id: string) {
    useEffect(() => {
        void controller.load(id)
        return () => controller.cancelRequest()
    }, [controller, id])
    const snapshot = useStore(controller.store, (s) => s.snapshot)
    const status = useStore(controller.store, (s) => s.status)
    const busy = useStore(controller.store, (s) => s.busy || !!s.animation || !!s.pendingSave)
    return {snapshot, status, busy}
}
