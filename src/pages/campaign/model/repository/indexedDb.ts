import type {CampaignRepository, CampaignSnapshot} from './types'
import {snapshotSchema, actionSchema} from './validation'

/** Открывает локальный репозиторий с атомарной записью снимка и истории команды. */
export function createRepository(name = 'dnd-vtt-v1'): CampaignRepository {
    let connection: Promise<IDBDatabase> | undefined
    const open = () =>
        (connection ??= new Promise((resolve, reject) => {
            if (!globalThis.indexedDB) {
                reject(Error('IndexedDB недоступен. Разрешите локальное хранение.'))
                return
            }
            const req = indexedDB.open(name, 1)
            req.onupgradeneeded = () => {
                req.result.createObjectStore('campaigns', {keyPath: 'state.id'})
                req.result.createObjectStore('actions', {keyPath: 'command.id'})
            }
            req.onsuccess = () => {
                req.result.onversionchange = () => {
                    req.result.close()
                    connection = undefined
                }
                resolve(req.result)
            }
            req.onerror = () => {
                connection = undefined
                reject(Error('Не удалось открыть локальное хранилище.'))
            }
            req.onblocked = () => reject(Error('Хранилище заблокировано другой вкладкой.'))
        }))
    const read = async (store: string, id: string): Promise<unknown> => {
        const db = await open()
        return new Promise((resolve, reject) => {
            const req = db.transaction(store).objectStore(store).get(id)
            req.onsuccess = () => resolve(req.result)
            req.onerror = () => reject(Error('Ошибка чтения сохранения.'))
        })
    }
    const parse = (value: unknown): CampaignSnapshot => {
        const result = snapshotSchema.safeParse(value)
        if (!result.success)
            throw Error(
                'Сохранение повреждено или имеет неподдерживаемую версию. Данные оставлены в хранилище.',
            )
        return result.data
    }
    return {
        async load(id) {
            const value = await read('campaigns', id)
            return value === undefined ? null : parse(value)
        },
        async create(state) {
            const db = await open()
            const snapshot: CampaignSnapshot = {version: 1, state, events: []}
            parse(snapshot)
            return new Promise((resolve, reject) => {
                const tx = db.transaction('campaigns', 'readwrite')
                tx.objectStore('campaigns').add(snapshot)
                tx.oncomplete = () => resolve(structuredClone(snapshot))
                tx.onabort = () => reject(Error('Кампания уже существует или запись недоступна.'))
            })
        },
        async commit(action) {
            const db = await open()
            return new Promise((resolve, reject) => {
                const tx = db.transaction(['campaigns', 'actions'], 'readwrite')
                let snapshot: CampaignSnapshot
                let error = 'Не удалось сохранить действие. Повторите запись.'
                const request = tx.objectStore('actions').get(action.command.id)
                request.onsuccess = () => {
                    const current = tx.objectStore('campaigns').get(action.beforeState.id)
                    current.onsuccess = () => {
                        try {
                            snapshot = parse(current.result)
                            if (request.result) return
                            if (snapshot.state.revision !== action.command.expectedRevision) {
                                error =
                                    'Состояние изменилось в другой вкладке. Перезагрузите кампанию.'
                                tx.abort()
                                return
                            }
                            const offset = snapshot.events.length
                            snapshot = {
                                version: 1,
                                state: action.result.nextState,
                                events: [
                                    ...snapshot.events,
                                    ...action.result.events.map((e, i) => ({
                                        ...e,
                                        sequence: offset + i,
                                    })),
                                ],
                            }
                            parse(snapshot)
                            tx.objectStore('campaigns').put(snapshot)
                            tx.objectStore('actions').add(action)
                        } catch {
                            error = 'Повреждённое сохранение. Запись отменена.'
                            tx.abort()
                        }
                    }
                }
                tx.oncomplete = () => resolve(structuredClone(snapshot))
                tx.onabort = () => reject(Error(error))
            })
        },
        async getAction(id) {
            const raw = await read('actions', id)
            if (raw === undefined) return null
            const parsed = actionSchema.safeParse(raw)
            if (!parsed.success)
                throw Error('История действия повреждена. Данные сохранены для восстановления.')
            return parsed.data
        },
    }
}
