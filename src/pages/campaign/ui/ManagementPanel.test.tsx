import {render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {MemoryRouter, Routes, Route} from 'react-router'
import {expect, it, vi} from 'vitest'

import {createCampaignController} from '../model/campaignStore'
import {localParser} from '../model/parser/localParser'
import {createRepository} from '../model/repository/indexedDb'
import {CampaignPage} from './CampaignPage'

vi.mock('../hooks/useScene', () => ({useScene: () => ({error: null})}))
it('создание → редактор героя и монстра → сцена → импорт копии кампании', async () => {
    const repository = createRepository(crypto.randomUUID())
    const controller = createCampaignController({
        repository,
        parser: localParser,
        dice: {roll: () => 15},
    })
    render(
        <MemoryRouter initialEntries={['/campaign/demo']}>
            <Routes>
                <Route
                    path="/campaign/:campaignId"
                    element={<CampaignPage controller={controller} />}
                />
            </Routes>
        </MemoryRouter>,
    )
    const user = userEvent.setup()
    await screen.findByRole('button', {name: /Создать демо/})
    await user.click(screen.getByRole('button', {name: 'Кампании и редакторы'}))
    await user.type(screen.getByRole('textbox', {name: /Название/}), 'Тестовое приключение')
    await user.click(screen.getByRole('button', {name: 'Создать кампанию'}))
    await screen.findByRole('heading', {name: 'Тестовое приключение'})
    const originalId = controller.store.getState().snapshot!.state.id
    await user.click(screen.getByRole('button', {name: 'Участники'}))
    await user.click(screen.getByRole('button', {name: 'Добавить персонажа'}))
    const name = screen.getByRole('textbox', {name: 'Имя'})
    await user.clear(name)
    await user.type(name, 'Эльна')
    await user.type(screen.getByRole('textbox', {name: 'Класс / тип существа'}), 'Следопыт')
    await user.click(screen.getByRole('button', {name: 'Сохранить участника'}))
    await screen.findByRole('button', {name: 'Редактировать Эльна'})
    await user.click(screen.getByRole('button', {name: 'Добавить монстра'}))
    await user.click(screen.getByRole('button', {name: 'Сохранить участника'}))
    await screen.findByRole('button', {name: 'Редактировать Новый монстр'})
    expect(Object.keys(controller.store.getState().snapshot!.state.combatants)).toHaveLength(2)
    await user.click(screen.getByRole('button', {name: 'Сцены'}))
    await user.type(screen.getByRole('textbox', {name: /Название/}), 'Подземелье')
    await user.click(screen.getByRole('button', {name: 'Создать сцену'}))
    await screen.findByRole('heading', {name: 'Подземелье'})
    expect(Object.keys(controller.store.getState().snapshot!.state.combatants)).toHaveLength(0)
    await waitFor(() =>
        expect(screen.getByRole('button', {name: 'Тестовое приключение'})).toBeEnabled(),
    )
    await user.click(screen.getByRole('button', {name: 'Тестовое приключение'}))
    await waitFor(() => expect(controller.store.getState().busy).toBe(false))
    await screen.findByRole('heading', {name: 'Эльна'})
    await user.click(screen.getByRole('button', {name: 'JSON'}))
    await user.click(screen.getByRole('button', {name: 'Подготовить экспорт'}))
    await screen.findByText('JSON подготовлен. Можно скачать файл.')
    await user.click(screen.getByRole('button', {name: 'Импортировать копию'}))
    await waitFor(() => expect(controller.store.getState().snapshot?.state.id).not.toBe(originalId))
    expect(await repository.list()).toHaveLength(2)
    expect(Object.keys((await repository.load(originalId))!.state.combatants)).toHaveLength(2)
    await user.click(screen.getByRole('button', {name: 'Кампании'}))
    await screen.findByRole('button', {name: 'Тестовое приключение (копия) · открыта'})
})
