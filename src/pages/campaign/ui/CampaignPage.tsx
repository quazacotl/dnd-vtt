import {BookOpen, Settings, Swords, ChevronRight, ShieldCheck, ScrollText} from 'lucide-react'
import {useState, useCallback} from 'react'
import {useParams, useSearchParams, useNavigate} from 'react-router'
import {useStore} from 'zustand'

import {routes} from '@/shared/config/routes'
import {Badge} from '@/shared/ui/badge'
import {Button} from '@/shared/ui/button'

import {useCampaign} from '../hooks/useCampaign'
import {useConnectionSettings} from '../hooks/useConnectionSettings'
import type {CampaignController} from '../model/campaignStore'
import {ChatPanel} from './ChatPanel'
import {ConnectionSettings} from './ConnectionSettings'
import {ManagementPanel} from './ManagementPanel'
import {ParticipantsPanel} from './ParticipantsPanel'
import {SceneView} from './SceneView'

export function CampaignPage({controller}: {controller: CampaignController}) {
    const {campaignId = 'demo'} = useParams()
    const navigate = useNavigate()
    const [params, setParams] = useSearchParams()
    const {snapshot, status, busy} = useCampaign(controller, campaignId, params.get('scene'))
    const error = useStore(controller.store, (s) => s.error)
    const pending = useStore(controller.store, (s) => s.pendingSave)
    const [managementOpen, setManagementOpen] = useState(false)
    const [settingsOpen, setSettingsOpen] = useState(false)
    const connection = useConnectionSettings(controller)
    const candidate = params.get('selected') ?? 'hero'
    const selected =
        snapshot && Object.hasOwn(snapshot.state.combatants, candidate)
            ? candidate
            : (Object.keys(snapshot?.state.combatants ?? {})[0] ?? '')
    const onSelect = useCallback(
        (id: string) =>
            setParams((p) => {
                const next = new URLSearchParams(p)
                next.set('selected', id)
                return next
            }),
        [setParams],
    )
    const state = snapshot?.state
    return (
        <div className="app-shell">
            <header className="app-header">
                <div className="brand-mark">
                    <BookOpen size={24} />
                </div>
                <div className="brand">
                    <strong>Серебряный дозор</strong>
                    <span>ВИРТУАЛЬНЫЙ СТОЛ · D&D 5E</span>
                </div>
                <div className="header-meta">
                    <Badge variant="outline">2014 · базовые правила</Badge>
                    <span>
                        <ShieldCheck size={14} /> Локальное сохранение
                    </span>
                </div>
                <Button variant="secondary" onClick={() => setManagementOpen((v) => !v)}>
                    <BookOpen size={15} /> Кампании и редакторы
                </Button>
                <Button variant="outline" onClick={() => setSettingsOpen((v) => !v)}>
                    <Settings size={15} /> Настройки
                </Button>
            </header>
            {managementOpen && (
                <ManagementPanel
                    controller={controller}
                    snapshot={snapshot}
                    selected={selected}
                    disabled={busy}
                    onClose={() => setManagementOpen(false)}
                />
            )}
            {settingsOpen && (
                <ConnectionSettings
                    settings={connection.connection.settings}
                    apiKey={connection.connection.apiKey}
                    onSave={connection.apply}
                    onClose={() => setSettingsOpen(false)}
                    error={connection.error}
                />
            )}
            {error && (
                <div role="alert" className="error-banner">
                    <span>{error}</span>
                    {pending ? (
                        <Button
                            disabled={busy && !pending}
                            size="sm"
                            onClick={() => void controller.retrySave()}
                        >
                            Повторить запись
                        </Button>
                    ) : (
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => void controller.load(campaignId)}
                        >
                            Перезагрузить кампанию
                        </Button>
                    )}
                </div>
            )}
            {status === 'loading' && (
                <main className="empty-screen">
                    <p>Загрузка кампании…</p>
                </main>
            )}
            {(status === 'empty' || (status === 'error' && !state)) && (
                <main className="empty-screen">
                    <ScrollText size={42} />
                    <span className="eyebrow">ПЕРВАЯ ГЛАВА</span>
                    <h1>
                        Каждое приключение
                        <br />
                        начинается с действия.
                    </h1>
                    <p>
                        Откройте тестовую сцену. Герой и гоблин уже рядом —<br />
                        остаётся бросить инициативу и описать атаку.
                    </p>
                    {status === 'empty' && (
                        <Button
                            size="lg"
                            disabled={busy}
                            onClick={async () => {
                                await controller.createDemo()
                                void navigate(routes.campaign('demo'))
                            }}
                        >
                            Создать демо-кампанию <ChevronRight size={17} />
                        </Button>
                    )}
                    <small>Без backend · IndexedDB · подключаемая Qwen</small>
                </main>
            )}
            {state && (
                <>
                    <div className="campaign-toolbar">
                        <div>
                            <span className="eyebrow">{snapshot.name}</span>
                            <h1>{state.scene.name}</h1>
                        </div>
                        <div className="combat-controls">
                            <span className="combat-status">
                                {state.combat.active
                                    ? `Раунд ${state.combat.round} · ${state.combat.actionAvailable ? 'Действие доступно' : 'Действие использовано'} · движение ${state.combat.movementRemaining} фт`
                                    : 'Исследование'}
                            </span>
                            {state.combat.active ? (
                                <>
                                    <Button
                                        disabled={busy}
                                        variant="secondary"
                                        onClick={() => void controller.endTurn()}
                                    >
                                        Завершить ход <ChevronRight size={16} />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        disabled={busy}
                                        onClick={() => void controller.stopCombat()}
                                    >
                                        Завершить бой
                                    </Button>
                                </>
                            ) : (
                                <Button
                                    disabled={busy}
                                    onClick={() => void controller.startCombat()}
                                >
                                    <Swords size={16} /> Начать бой
                                </Button>
                            )}
                        </div>
                    </div>
                    <main className="workspace">
                        <ParticipantsPanel state={state} selected={selected} onSelect={onSelect} />
                        <SceneView
                            controller={controller}
                            selected={selected}
                            onSelect={onSelect}
                        />
                        <ChatPanel controller={controller} disabled={busy} />
                    </main>
                    <footer className="app-footer">
                        <span>
                            <span className="live-dot" />{' '}
                            {connection.connection.settings.parserMode === 'local'
                                ? 'Локальный parser'
                                : 'Qwen · ' + connection.connection.settings.model}
                        </span>
                        <span>
                            {snapshot.events.length} событий · ревизия {state.revision} ·{' '}
                            {busy ? 'Обработка…' : 'Сохранено локально'}
                        </span>
                    </footer>
                </>
            )}
        </div>
    )
}
