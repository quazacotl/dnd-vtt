import {Send, MessageSquare, RotateCcw, Check} from 'lucide-react'
import {useEffect, useRef} from 'react'
import {useForm} from 'react-hook-form'
import {useStore} from 'zustand'

import {Button} from '@/shared/ui/button'
import {Textarea} from '@/shared/ui/textarea'

import type {CampaignController} from '../model/campaignStore'
import {describeEvent} from '../utils/utils'

export function ChatPanel({
    controller,
    disabled,
}: {
    controller: CampaignController
    disabled: boolean
}) {
    const snapshot = useStore(controller.store, (s) => s.snapshot)
    const clarification = useStore(controller.store, (s) => s.clarification)
    const notice = useStore(controller.store, (s) => s.notice)
    const waiting = useStore(controller.store, (s) => s.parsing)
    const texts = useStore(controller.store, (s) => s.texts)
    const {register, handleSubmit, reset} = useForm<{text: string}>({defaultValues: {text: ''}})
    const bottom = useRef<HTMLDivElement>(null)
    const viewport = useRef<HTMLDivElement>(null)
    useEffect(() => {
        if (viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight
    }, [snapshot?.events.length, clarification, notice])
    const submit = handleSubmit(async ({text}) => {
        if (!text.trim()) return
        await controller.submitMessage(text)
        reset()
    })
    const events = snapshot?.events ?? []
    return (
        <aside className="chat-panel">
            <div className="chat-heading">
                <MessageSquare size={16} />
                <strong>Хроника приключения</strong>
                <span className="live-dot" />
            </div>
            <div ref={viewport} className="chat-scroll" aria-live="polite">
                <div className="narrator-card">
                    <div className="message-label">
                        РАССКАЗЧИК <span>НАЧАЛО СЦЕНЫ</span>
                    </div>
                    <p>
                        Среди покрытых мхом руин слышится скрежет стали. Из тени выступает гоблин.
                        Лирам перехватывает меч — противник уже рядом.
                    </p>
                    <small>Опишите действие. Правила и броски проверит движок.</small>
                </div>
                {!events.length && (
                    <div className="chat-hint">
                        Начните бой и дождитесь хода Лирама. Затем попробуйте:{' '}
                        <strong>«Атакую гоблина мечом»</strong>.
                    </div>
                )}
                {snapshot &&
                    events.map((event, index) => (
                        <div
                            key={event.id}
                            className={`event-message ${event.type === 'attackRoll' ? 'attack-message' : ''}`}
                        >
                            {(event.type === 'attackRoll' || event.type === 'movement') &&
                                events[index - 1]?.commandId !== event.commandId &&
                                texts[event.commandId] && (
                                    <div className="user-message">
                                        <span className="message-label">ИГРОК</span>
                                        <p>{texts[event.commandId]}</p>
                                    </div>
                                )}
                            <div className="message-label">
                                <Check size={12} /> ДВИЖОК <span>#{event.sequence + 1}</span>
                            </div>
                            <p>{describeEvent(event, snapshot.state)}</p>
                            {(event.type === 'attackRoll' || event.type === 'movement') &&
                                events[index - 1]?.commandId !== event.commandId && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={disabled}
                                        onClick={() => void controller.replay(event.commandId)}
                                    >
                                        <RotateCcw size={12} /> Повторить анимацию
                                    </Button>
                                )}
                        </div>
                    ))}
                {notice && <p className="chat-hint">{notice}</p>}
                {clarification && (
                    <div className="clarification">
                        <p>{clarification.question}</p>
                        {clarification.options.map((o) => (
                            <Button
                                key={o.id}
                                variant="secondary"
                                disabled={disabled}
                                onClick={() => void controller.chooseTarget(o.id)}
                            >
                                {o.name} · {o.id}
                            </Button>
                        ))}
                    </div>
                )}
                <div ref={bottom} />
            </div>
            <form className="chat-compose" onSubmit={submit}>
                <label htmlFor="action-text">Ваше действие</label>
                <Textarea
                    id="action-text"
                    {...register('text', {required: true, maxLength: 4000})}
                    placeholder="Атакую гоблина мечом…"
                    disabled={disabled}
                />
                <div>
                    <small>Атака · «Иду на 3,5» · подход и атака</small>
                    <Button type="submit" disabled={disabled} aria-label="Отправить действие">
                        <Send size={15} />
                    </Button>
                </div>
                {waiting && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => controller.cancelRequest()}
                    >
                        Отменить запрос
                    </Button>
                )}
            </form>
        </aside>
    )
}
