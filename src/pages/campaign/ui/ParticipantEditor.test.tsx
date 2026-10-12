import {act, render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {MemoryRouter} from 'react-router'
import {expect, it, vi} from 'vitest'
import {useStore} from 'zustand'

import {createCampaignController} from '../model/campaignStore'
import type {Combatant, Cell} from '../model/engine/types'
import {newCampaign, newParticipant, editParticipant} from '../model/management'
import {localParser} from '../model/parser/localParser'
import {createRepository} from '../model/repository/indexedDb'
import {ManagementPanel} from './ManagementPanel'
import {ParticipantEditor} from './ParticipantEditor'

it('редактирование заметок сохраняет отдельные одинаково названные предметы', async () => {
    const actor = newParticipant('character', 'Герой')
    actor.details!.inventory = [
        {name: 'Зелье', count: 2},
        {name: 'Зелье', count: 3},
    ]
    const save = vi
        .fn<(actor: Combatant, position: Cell) => Promise<void>>()
        .mockResolvedValue(undefined)
    render(
        <ParticipantEditor
            actor={actor}
            position={{x: 0, y: 0}}
            disabled={false}
            onSave={save}
            onCancel={() => {}}
        />,
    )
    const user = userEvent.setup()
    await user.type(
        screen.getByRole('textbox', {name: 'Заметки, предыстория и описание'}),
        'Запись',
    )
    await user.click(screen.getByRole('button', {name: 'Сохранить участника'}))
    await waitFor(() => expect(save).toHaveBeenCalled())
    expect(save.mock.calls[0][0].details!.inventory).toEqual(actor.details!.inventory)
})
it('повторное открытие участника начинает новый черновик с актуальными HP', async () => {
    const repo = createRepository(crypto.randomUUID())
    const actor = newParticipant('character', 'Герой')
    let snapshot = await repo.create(newCampaign('Тест', 8, 8), 'Тест')
    snapshot = await repo.replace(
        editParticipant(snapshot, actor, {x: 0, y: 0}),
        snapshot.state.revision,
    )
    const controller = createCampaignController({
        repository: repo,
        parser: localParser,
        dice: {roll: () => 15},
    })
    await controller.load(snapshot.state.id)
    function Host() {
        const current = useStore(controller.store, (s) => s.snapshot)
        return (
            <ManagementPanel
                controller={controller}
                snapshot={current}
                selected={actor.id}
                disabled={false}
                onClose={() => {}}
            />
        )
    }
    render(
        <MemoryRouter>
            <Host />
        </MemoryRouter>,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', {name: 'Участники'}))
    await user.click(screen.getByRole('button', {name: 'Редактировать Герой'}))
    await act(async () => {
        await controller.saveParticipant({...actor, hp: 7}, {x: 0, y: 0})
    })
    await user.click(screen.getByRole('button', {name: 'Редактировать Герой'}))
    expect(screen.getByRole('spinbutton', {name: 'HP'})).toHaveValue(7)
    await user.click(screen.getByRole('button', {name: 'Сохранить участника'}))
    await waitFor(() =>
        expect(controller.store.getState().snapshot!.state.combatants[actor.id].hp).toBe(7),
    )
})
