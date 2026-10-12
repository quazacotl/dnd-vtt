import {useEffect, useState} from 'react'
import {useNavigate} from 'react-router'
import {useStore} from 'zustand'

import {routes} from '@/shared/config/routes'

import type {CampaignController} from '../model/campaignStore'
import type {Combatant, Cell} from '../model/engine/types'
import {newParticipant, freeCell} from '../model/management'

/** Связывает каталог, создание сцен и редактор с подтверждённым состоянием кампании. */
export function useCampaignManagement(controller: CampaignController) {
    const navigate = useNavigate()
    const [catalog, setCatalog] = useState<{id: string; name: string}[]>([])
    const [error, setError] = useState<string | null>(null)
    const scope = useStore(controller.store, (s) =>
        s.snapshot ? `${s.snapshot.state.id}:${s.snapshot.state.scene.id}` : '',
    )
    const [editing, setEditing] = useState<{
        actor: Combatant
        position: Cell
        scope: string
        baseRevision: number
        sessionId: string
    } | null>(null)
    const refresh = async () => {
        try {
            setCatalog(await controller.listCampaigns())
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Ошибка списка кампаний.')
        }
    }
    useEffect(() => {
        let active = true
        void controller
            .listCampaigns()
            .then((rows) => {
                if (active) setCatalog(rows)
            })
            .catch((e) => {
                if (active) setError(e instanceof Error ? e.message : 'Ошибка списка кампаний.')
            })
        return () => {
            active = false
        }
    }, [controller, scope])
    const perform = async <T>(task: () => Promise<T>): Promise<T | null> => {
        setError(null)
        try {
            const result = await task()
            await refresh()
            return result
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Ошибка операции.')
            return null
        }
    }
    const create = async (
        kind: 'campaign' | 'scene',
        name: string,
        width: number,
        height: number,
    ) => {
        const result = await perform(() =>
            kind === 'campaign'
                ? controller.createCampaign(name, width, height)
                : controller.addScene(name, width, height),
        )
        if (result) void navigate(routes.scene(result.state.id, result.state.scene.id))
    }
    const selectScene = async (id: string) => {
        const result = await perform(() => controller.switchScene(id))
        if (result) void navigate(routes.scene(result.state.id, result.state.scene.id))
    }
    const openEditor = (kind: 'character' | 'creature', id?: string) => {
        try {
            const s = controller.store.getState().snapshot
            if (!s) throw Error('Откройте кампанию.')
            if (s.state.combat.active) throw Error('Сначала завершите бой.')
            const actor = id
                ? s.state.combatants[id]
                : newParticipant(kind, kind === 'character' ? 'Новый герой' : 'Новый монстр')
            const token = id ? s.state.scene.tokens.find((t) => t.combatantId === id) : null
            if (!actor) throw Error('Участник не найден.')
            setEditing({
                sessionId: crypto.randomUUID(),
                baseRevision: s.state.revision,
                scope: `${s.state.id}:${s.state.scene.id}`,
                actor: structuredClone(actor),
                position: token ? {x: token.x, y: token.y} : freeCell(s.state),
            })
            setError(null)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Ошибка редактора.')
        }
    }
    const save = async (actor: Combatant, position: Cell) => {
        const result = await perform(() => {
            if (editing?.baseRevision !== controller.store.getState().snapshot?.state.revision)
                throw Error(
                    'Сцена изменилась. Откройте редактор заново, чтобы сохранить актуальные данные.',
                )
            return controller.saveParticipant(actor, position)
        })
        if (result) setEditing(null)
    }
    return {
        catalog,
        error,
        editing: editing?.scope === scope ? editing : null,
        setEditing,
        perform,
        create,
        selectScene,
        openEditor,
        save,
        openCampaign: (id: string) => {
            void navigate(routes.campaign(id))
        },
    }
}
