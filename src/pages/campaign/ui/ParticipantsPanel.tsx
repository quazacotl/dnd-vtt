import {Shield, Heart, Swords} from 'lucide-react'

import {Badge} from '@/shared/ui/badge'

import type {GameState} from '../model/engine/types'

export function ParticipantsPanel({
    state,
    selected,
    onSelect,
}: {
    state: GameState
    selected: string
    onSelect: (id: string) => void
}) {
    const active = state.combat.active ? state.combat.order[state.combat.index] : null
    const character = state.combatants[selected]
    return (
        <aside className="participants">
            <div className="panel-label">
                УЧАСТНИКИ <span>02</span>
            </div>
            {Object.values(state.combatants).map((c) => (
                <button
                    key={c.id}
                    className={`participant ${selected === c.id ? 'selected' : ''}`}
                    onClick={() => onSelect(c.id)}
                    aria-pressed={selected === c.id}
                >
                    <span className={`portrait ${c.side}`}>{c.name.slice(0, 1)}</span>
                    <span className="participant-info">
                        <strong>{c.name}</strong>
                        <small>
                            {c.side === 'party' ? 'Герой · Воин' : 'Противник · Гуманоид'}
                        </small>
                        <span className="hp-track">
                            <span style={{width: `${(c.hp / c.maxHp) * 100}%`}} />
                        </span>
                        <small>
                            {c.hp} / {c.maxHp} HP{c.hp === 0 ? ' · Побеждён' : ''}
                        </small>
                    </span>
                    {active === c.id && <span className="turn-dot" aria-label="Активный ход" />}
                </button>
            ))}
            <div className="panel-label initiative-label">
                ИНИЦИАТИВА <Swords size={14} />
            </div>
            {state.combat.order.length ? (
                state.combat.order.map((id, index) => (
                    <div className={`initiative-row ${active === id ? 'active' : ''}`} key={id}>
                        <span className="order">{index + 1}</span>
                        <span>{state.combatants[id].name}</span>
                        <small>
                            {active === id
                                ? 'ХОД'
                                : state.combatants[id].hp === 0
                                  ? 'ПОБЕЖДЁН'
                                  : 'ОЖИДАЕТ'}
                        </small>
                    </div>
                ))
            ) : (
                <p className="muted empty-initiative">
                    Начните бой, чтобы определить порядок ходов.
                </p>
            )}
            {character && (
                <div className="character-detail">
                    <div className="panel-label">ВЫБРАННЫЙ УЧАСТНИК</div>
                    <h2>{character.name}</h2>
                    <Badge variant="secondary">
                        {character.side === 'party' ? 'Союзник' : 'Противник'}
                    </Badge>
                    <div className="stat-grid">
                        <div>
                            <Heart size={16} />
                            <strong>{character.hp}</strong>
                            <small>HP / {character.maxHp}</small>
                        </div>
                        <div>
                            <Shield size={16} />
                            <strong>{character.ac}</strong>
                            <small>Класс брони</small>
                        </div>
                    </div>
                    <div className="weapon">
                        <Swords size={16} />
                        <span>
                            {character.weapons[0]?.name}
                            <small>
                                +{character.weapons[0]?.bonus} к атаке · 1d
                                {character.weapons[0]?.damageDie}+
                                {character.weapons[0]?.damageBonus}
                            </small>
                        </span>
                    </div>
                    <p className="muted">
                        Скорость: {character.speed} футов. Редактор появится в следующем срезе.
                    </p>
                </div>
            )}
        </aside>
    )
}
