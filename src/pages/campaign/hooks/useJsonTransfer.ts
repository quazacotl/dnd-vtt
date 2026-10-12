import {useState} from 'react'
import {useForm} from 'react-hook-form'
import {useNavigate} from 'react-router'

import {routes} from '@/shared/config/routes'

import type {CampaignController} from '../model/campaignStore'
import {freeCell} from '../model/management'

/** Управляет чтением файла, проверенным импортом копии и скачиванием локального JSON. */
export function useJsonTransfer(controller: CampaignController, selected: string) {
    const form = useForm<{kind: 'campaign' | 'scene' | 'participant'; text: string}>({
        defaultValues: {kind: 'campaign', text: ''},
    })
    const [error, setError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)
    const [working, setWorking] = useState(false)
    const navigate = useNavigate()
    const perform = async (task: () => Promise<void>) => {
        setWorking(true)
        setError(null)
        setNotice(null)
        try {
            await task()
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Ошибка JSON.')
        } finally {
            setWorking(false)
        }
    }
    const loadFile = (file: File) =>
        perform(async () => {
            if (file.size > 20 * 1024 * 1024) throw Error('Файл больше 20 МБ.')
            form.setValue('text', await file.text())
            setNotice('Файл прочитан. Проверьте тип и нажмите «Импортировать копию».')
        })
    const exportJson = () =>
        perform(async () => {
            const kind = form.getValues('kind')
            const text =
                kind === 'campaign'
                    ? await controller.exportCampaign()
                    : kind === 'scene'
                      ? controller.exportCurrentScene()
                      : controller.exportParticipant(selected)
            form.setValue('text', text)
            setNotice('JSON подготовлен. Можно скачать файл.')
        })
    const importJson = () =>
        perform(async () => {
            const {kind, text} = form.getValues()
            if (!text.trim()) throw Error('Выберите файл или вставьте JSON.')
            if (text.length > 20 * 1024 * 1024) throw Error('JSON больше 20 МБ.')
            if (kind === 'campaign') {
                const result = await controller.importCampaign(text)
                void navigate(routes.scene(result.state.id, result.state.scene.id))
            } else if (kind === 'scene') {
                const result = await controller.importCurrentScene(text)
                void navigate(routes.scene(result.state.id, result.state.scene.id))
            } else {
                const s = controller.store.getState().snapshot
                if (!s) throw Error('Откройте кампанию.')
                await controller.importParticipant(text, freeCell(s.state))
            }
            setNotice('Копия импортирована. Оригинальные данные сохранены.')
        })
    const download = () => {
        const {text, kind} = form.getValues()
        if (!text) return
        const url = URL.createObjectURL(new Blob([text], {type: 'application/json'}))
        const link = document.createElement('a')
        link.href = url
        link.download = `dnd-${kind}.json`
        link.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
    return {form, error, notice, working, loadFile, exportJson, importJson, download}
}
