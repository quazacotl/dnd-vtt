import {act, render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {StrictMode} from 'react'
import {MemoryRouter} from 'react-router'
import {expect, it, vi} from 'vitest'

import {createCampaignController} from '../model/campaignStore'
import {localParser} from '../model/parser/localParser'
import {createRepository} from '../model/repository/indexedDb'
import {CampaignPage} from './CampaignPage'

vi.mock('../hooks/useScene', () => ({useScene: () => ({error: null})}))
it('empty → демо → бой → атака; показывает итог в чате', async () => {
    const controller = createCampaignController({
        repository: createRepository(crypto.randomUUID()),
        parser: localParser,
        dice: {roll: (s) => (s === 20 ? 15 : 4)},
    })
    render(
        <StrictMode>
            <MemoryRouter>
                <CampaignPage controller={controller} />
            </MemoryRouter>
        </StrictMode>,
    )
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', {name: 'Создать демо-кампанию'}))
    await screen.findByRole('heading', {name: 'Лирам'})
    await user.click(screen.getByRole('button', {name: 'Начать бой'}))
    await waitFor(() =>
        expect(controller.store.getState().snapshot?.state.combat.active).toBe(true),
    )
    await act(async () => {
        controller.finishAnimation()
    })
    if (controller.store.getState().snapshot?.state.combat.order[0] === 'goblin') {
        await act(async () => {
            await controller.endTurn()
            controller.finishAnimation()
        })
    }
    await user.type(screen.getByRole('textbox', {name: 'Ваше действие'}), 'Атакую гоблина мечом')
    await user.click(screen.getByRole('button', {name: 'Отправить действие'}))
    await screen.findByText(/Урон: 7/)
    expect(controller.store.getState().snapshot?.state.combatants.goblin.hp).toBe(5)
})
