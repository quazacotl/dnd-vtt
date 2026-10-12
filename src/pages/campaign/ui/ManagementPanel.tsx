import {useState} from 'react'

import {Button} from '@/shared/ui/button'

import {useCampaignManagement} from '../hooks/useCampaignManagement'
import type {CampaignController} from '../model/campaignStore'
import type {CampaignSnapshot} from '../model/repository/types'
import {CreateWorldForm} from './CreateWorldForm'
import {JsonTransfer} from './JsonTransfer'
import {ParticipantEditor} from './ParticipantEditor'

export function ManagementPanel({
    controller,
    snapshot,
    selected,
    disabled,
    onClose,
}: {
    controller: CampaignController
    snapshot: CampaignSnapshot | null
    selected: string
    disabled: boolean
    onClose: () => void
}) {
    const management = useCampaignManagement(controller)
    const [tab, setTab] = useState<'campaigns' | 'scenes' | 'participants' | 'json'>('campaigns')
    const state = snapshot?.state
    const locked = disabled || !!state?.combat.active
    return (
        <section className="management-panel" aria-label="Управление кампанией">
            <div className="management-heading">
                <h2>Ваши приключения</h2>
                <Button variant="ghost" onClick={onClose}>
                    Закрыть управление
                </Button>
            </div>
            <nav className="management-tabs" aria-label="Разделы управления">
                {(['campaigns', 'scenes', 'participants', 'json'] as const).map((key, i) => (
                    <Button
                        key={key}
                        variant={key === tab ? 'default' : 'secondary'}
                        aria-pressed={key === tab}
                        onClick={() => setTab(key)}
                    >
                        {['Кампании', 'Сцены', 'Участники', 'JSON'][i]}
                    </Button>
                ))}
            </nav>
            {management.error && <p role="alert">{management.error}</p>}
            {tab === 'campaigns' && (
                <>
                    <div className="catalog-list">
                        {management.catalog.length === 0 ? (
                            <p>Сохранённых кампаний пока нет.</p>
                        ) : (
                            management.catalog.map((c) => (
                                <Button
                                    key={c.id}
                                    variant="outline"
                                    disabled={disabled}
                                    onClick={() => management.openCampaign(c.id)}
                                >
                                    {c.name}
                                    {c.id === state?.id ? ' · открыта' : ''}
                                </Button>
                            ))
                        )}
                    </div>
                    <CreateWorldForm
                        kind="campaign"
                        disabled={disabled}
                        onCreate={(name, w, h) => management.create('campaign', name, w, h)}
                    />
                </>
            )}
            {tab === 'scenes' && (
                <>
                    {state ? (
                        <>
                            <div className="catalog-list">
                                <Button variant="secondary" disabled>
                                    {state.scene.name} · активна
                                </Button>
                                {Object.values(snapshot!.inactiveScenes).map((s) => (
                                    <Button
                                        key={s.scene.id}
                                        variant="outline"
                                        disabled={disabled}
                                        onClick={() => void management.selectScene(s.scene.id)}
                                    >
                                        {s.scene.name}
                                    </Button>
                                ))}
                            </div>
                            <CreateWorldForm
                                kind="scene"
                                disabled={disabled}
                                onCreate={(name, w, h) => management.create('scene', name, w, h)}
                            />
                        </>
                    ) : (
                        <p>Сначала создайте или откройте кампанию.</p>
                    )}
                </>
            )}
            {tab === 'participants' && (
                <>
                    {state ? (
                        <>
                            <div className="settings-actions">
                                <Button
                                    disabled={locked}
                                    onClick={() => management.openEditor('character')}
                                >
                                    Добавить персонажа
                                </Button>
                                <Button
                                    variant="secondary"
                                    disabled={locked}
                                    onClick={() => management.openEditor('creature')}
                                >
                                    Добавить монстра
                                </Button>
                            </div>
                            {state.combat.active && (
                                <p>Для редактирования сначала завершите бой.</p>
                            )}
                            <div className="catalog-list">
                                {Object.values(state.combatants).map((c) => (
                                    <div key={c.id}>
                                        <strong>{c.name}</strong>
                                        <span>
                                            {c.hp}/{c.maxHp} HP · AC {c.ac}
                                        </span>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={locked}
                                            onClick={() =>
                                                management.openEditor(
                                                    c.details?.kind ??
                                                        (c.side === 'party'
                                                            ? 'character'
                                                            : 'creature'),
                                                    c.id,
                                                )
                                            }
                                        >
                                            Редактировать {c.name}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            disabled={locked}
                                            onClick={() =>
                                                void management.perform(() =>
                                                    controller.deleteParticipant(c.id),
                                                )
                                            }
                                        >
                                            Удалить {c.name}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                            {management.editing && (
                                <ParticipantEditor
                                    key={management.editing.sessionId}
                                    actor={management.editing.actor}
                                    position={management.editing.position}
                                    disabled={locked}
                                    onSave={management.save}
                                    onCancel={() => management.setEditing(null)}
                                />
                            )}
                        </>
                    ) : (
                        <p>Сначала откройте кампанию.</p>
                    )}
                </>
            )}
            {tab === 'json' && (
                <JsonTransfer controller={controller} selected={selected} disabled={disabled} />
            )}
        </section>
    )
}
