import {Expand, Layers} from 'lucide-react'
import {useRef} from 'react'

import {useScene} from '../hooks/useScene'
import type {CampaignController} from '../model/campaignStore'

export function SceneView({
    controller,
    selected,
    onSelect,
}: {
    controller: CampaignController
    selected: string
    onSelect: (id: string) => void
}) {
    const container = useRef<HTMLDivElement>(null)
    const {error} = useScene(container, controller, selected, onSelect)
    return (
        <section className="battlefield" aria-label="Тактическая карта">
            <div className="scene-title">
                <span>
                    <Layers size={15} /> ТАКТИЧЕСКАЯ СЦЕНА
                </span>
                <span>
                    <Expand size={14} /> Вид сверху
                </span>
            </div>
            <div ref={container} className="scene-canvas" />
            {error && (
                <p role="alert" className="scene-error">
                    {error}
                </p>
            )}
            <div className="scene-caption">
                <span>Руины Серебряного дозора</span>
                <span>1 клетка = 5 футов · клик по клетке: движение выбранного</span>
            </div>
        </section>
    )
}
