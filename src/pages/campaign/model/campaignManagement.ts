import type {StoreApi} from 'zustand/vanilla'

import type {CampaignView} from './campaignStore'
import type {Cell, Combatant} from './engine/types'
import {newCampaign, newScene, switchScene, editParticipant, removeParticipant} from './management'
import type {CampaignRepository, CampaignSnapshot} from './repository/types'
import {
    exportBundle,
    importBundle,
    exportCharacter,
    importCharacter,
    exportScene,
    importScene,
} from './transfer'

/** Создаёт административные операции текущей кампании с общим блокированием записи. */
export function createManagementActions(
    repo: CampaignRepository,
    store: StoreApi<CampaignView>,
    reload: (id: string) => Promise<void>,
) {
    const current = () => {
        const s = store.getState().snapshot
        if (!s) throw Error('Сначала откройте кампанию.')
        return s
    }
    const run = async (task: () => Promise<CampaignSnapshot>) => {
        const s = store.getState()
        if (s.busy || s.animation || s.pendingSave || s.status === 'loading')
            throw Error('Дождитесь завершения текущего действия.')
        store.setState({busy: true, error: null, clarification: null})
        try {
            const snapshot = await task()
            if (s.loadEpoch !== store.getState().loadEpoch)
                throw Error('Изменения сохранены, но кампания уже переключена.')
            await reload(snapshot.state.id)
            if (s.loadEpoch + 1 !== store.getState().loadEpoch)
                throw Error('Кампания уже переключена. Изменения сохранены.')
            return snapshot
        } catch (e) {
            if (s.loadEpoch === store.getState().loadEpoch)
                store.setState({
                    busy: false,
                    error: e instanceof Error ? e.message : 'Ошибка изменения кампании.',
                })
            throw e
        }
    }
    const mutate = (transform: (s: CampaignSnapshot) => CampaignSnapshot) =>
        run(() => {
            const old = current()
            return repo.replace(transform(old), old.state.revision)
        })
    return {
        listCampaigns: () => repo.list(),
        createCampaign: (name: string, width: number, height: number) =>
            run(() => repo.create(newCampaign(name, width, height), name)),
        addScene: (name: string, width: number, height: number) =>
            mutate((s) => newScene(s, name, width, height)),
        switchScene: (id: string) => mutate((s) => switchScene(s, id)),
        saveParticipant: (actor: Combatant, position: Cell) =>
            mutate((s) => editParticipant(s, actor, position)),
        deleteParticipant: (id: string) => mutate((s) => removeParticipant(s, id)),
        exportCampaign: () => exportBundle(repo, current().state.id),
        importCampaign: (text: string) => run(() => importBundle(repo, text)),
        exportParticipant: (id: string) => {
            const actor = current().state.combatants[id]
            if (!actor) throw Error('Участник не найден.')
            return exportCharacter(actor)
        },
        importParticipant: (text: string, position: Cell) =>
            mutate((s) => editParticipant(s, importCharacter(text), position)),
        exportCurrentScene: () => exportScene(current().state),
        importCurrentScene: (text: string) => mutate((s) => importScene(s, text)),
    }
}
